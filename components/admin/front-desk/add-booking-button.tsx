'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { DayPicker, type DateRange } from 'react-day-picker';
import { format, parseISO } from 'date-fns';
import { PlusIcon } from '@heroicons/react/24/outline';
import { createFrontDeskBookingAction, quoteFrontDeskBookingAction, type FrontDeskQuoteResult } from '@/app/admin/front-desk/actions';
import type { PaymentMethod } from '@/lib/domain/schemas';
import { nightsBetween } from '@/lib/domain/pricing';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { DATE_FNS_LOCALES, lDateShort, lNights } from '@/lib/i18n/format';
import { fieldClass, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { CALENDAR_CLASS_NAMES, CALENDAR_COMPONENTS } from '@/components/search/stay-dates-field';
import { Modal } from '@/components/site/modal';
import { toast } from '@/components/admin/shell/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { emptyGuestParty, GuestPartyFields, PaymentMethodField, PriceFooter, type GuestParty } from './booking-form-fields';

const ISO = 'yyyy-MM-dd';

export interface BookableRoomType {
  id: string;
  slug: string;
  name: string;
}

/**
 * The header's own way in, beside the page title — the same spot every
 * other primary "Add …" in the admin uses (`AddRoomTypeButton`,
 * `/admin/content/add-ons`'s "Add service"), not the filter row beside it.
 * A room type and a date range picked by hand, no physical room chosen —
 * the same "any free room of this type" a guest gets by booking without the
 * floor plan; a drag on a specific room's row (`FrontDeskGrid`) is the other
 * way in, for when the room itself matters. Room and dates live here instead
 * of a `BookingDraft`; everything past that (the guest's own details, the
 * price, the submit) is the same `GuestPartyFields`/`PriceFooter` the drag's
 * own form uses, so the two read as one feature with two doors in.
 */
export function AddBookingButton({ roomTypes, today }: { roomTypes: BookableRoomType[]; today: string }) {
  const t = useAdminT();
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  if (roomTypes.length === 0) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill('primary')}>
        <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
        {t('frontDesk.addBooking')}
      </button>

      <Modal open={open} onClose={close} className="sm:max-w-2xl" title={t('frontDesk.addBooking')}>
        {open ? <NewBookingForm roomTypes={roomTypes} today={today} onCancel={close} /> : null}
      </Modal>
    </>
  );
}

function NewBookingForm({ roomTypes, today, onCancel }: { roomTypes: BookableRoomType[]; today: string; onCancel: () => void }) {
  const router = useRouter();
  const t = useAdminT();
  const locale = useAdminLocale();
  const dateFns = DATE_FNS_LOCALES[locale];
  const [months, setMonths] = React.useState(1);
  const [roomTypeId, setRoomTypeId] = React.useState(roomTypes[0]!.id);
  const [range, setRange] = React.useState<DateRange | undefined>(undefined);
  const [party, setParty] = React.useState<GuestParty>(emptyGuestParty);
  const [requestId] = React.useState(() => crypto.randomUUID());
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('pay_at_hotel');
  const [quote, setQuote] = React.useState<FrontDeskQuoteResult | null>(null);
  const [quoting, setQuoting] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [createdReference, setCreatedReference] = React.useState<string>();
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const query = window.matchMedia('(min-width: 640px)');
    const apply = () => setMonths(query.matches ? 2 : 1);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  const roomType = roomTypes.find((candidate) => candidate.id === roomTypeId) ?? roomTypes[0]!;
  const checkIn = range?.from ? format(range.from, ISO) : null;
  const checkOut = range?.to ? format(range.to, ISO) : null;
  const ready = Boolean(checkIn && checkOut && checkOut > checkIn);
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;

  React.useEffect(() => {
    if (!ready || !checkIn || !checkOut) {
      setQuote(null);
      return;
    }
    let live = true;
    setQuoting(true);
    quoteFrontDeskBookingAction({ roomSlug: roomType.slug, checkIn, checkOut, adults: party.adults, children: party.children }).then(
      (result) => {
        if (live) {
          setQuote(result);
          setQuoting(false);
        }
      },
    );
    return () => {
      live = false;
    };
  }, [ready, roomType.slug, checkIn, checkOut, party.adults, party.children]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!checkIn || !checkOut) return;
    setSubmitting(true);
    setError('');
    setFieldErrors({});
    const { firstName, lastName, email, phone, adults, children } = party;
    const documentUpload = new FormData();
    if (party.document) documentUpload.set('photo', party.document.photo);
    const result = await createFrontDeskBookingAction({
      requestId,
      identity: party.document?.identity,
      roomSlug: roomType.slug,
      checkIn,
      checkOut,
      adults,
      children,
      guest: { firstName, lastName, email, phone },
      paymentMethod,
    }, documentUpload).catch(() => ({ ok: false as const, message: 'Booking request failed. Please retry.', fieldErrors: {} }));
    setSubmitting(false);
    if (result.ok) {
      onCancel();
      toast.success(result.message);
      router.refresh();
      return;
    }
    setError(result.message);
    if ('createdReference' in result) setCreatedReference(result.createdReference);
    setFieldErrors(result.fieldErrors ?? {});
  }

  return (
    <form onSubmit={submit}>
      <div inert={submitting || Boolean(createdReference)}>
      <label htmlFor="fd-new-room-type" className="mb-1.5 block text-sm text-muted-foreground">
        {t('frontDesk.roomType')}
      </label>
      <Select items={roomTypes.map((candidate) => ({ value: candidate.id, label: candidate.name }))} value={roomTypeId} onValueChange={(value) => value && setRoomTypeId(value)}>
        <SelectTrigger id="fd-new-room-type" className={cn(fieldClass, 'h-11 w-full justify-between gap-2 py-0')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-2xl border border-border bg-card p-1.5 shadow-soft ring-0">
          {roomTypes.map((candidate) => (
            <SelectItem key={candidate.id} value={candidate.id} className="rounded-xl py-2 pl-2.5 text-sm data-highlighted:bg-stone data-highlighted:text-foreground">
              {candidate.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="mt-5 flex justify-center overflow-x-auto">
        <DayPicker
          mode="range"
          selected={range}
          onSelect={setRange}
          numberOfMonths={months}
          showOutsideDays={false}
          weekStartsOn={1}
          fixedWeeks
          disabled={{ before: parseISO(today) }}
          defaultMonth={range?.from ?? parseISO(today)}
          classNames={CALENDAR_CLASS_NAMES}
          components={CALENDAR_COMPONENTS}
          locale={dateFns}
        />
      </div>
      <p role="status" className="text-center text-sm text-muted-foreground">
        {!checkIn
          ? t('frontDesk.pickFirstNight')
          : ready
            ? t('frontDesk.rangeSummary', { from: lDateShort(checkIn, locale), to: lDateShort(checkOut!, locale), nights: lNights(nights, locale) })
            : t('frontDesk.pickSecondDay')}
      </p>

      <div className="mt-5">
        <GuestPartyFields value={party} onChange={(patch) => setParty((current) => ({ ...current, ...patch }))} t={t} fieldErrors={fieldErrors} />
      </div>

      <div className="mt-4">
        <PaymentMethodField value={paymentMethod} onChange={setPaymentMethod} t={t} locale={locale} />
      </div>

      {ready ? (
        <PriceFooter t={t} locale={locale} quoting={quoting} quote={quote} paymentMethod={paymentMethod} />
      ) : (
        <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">{t('frontDesk.pickRoomTypeAndDates')}</p>
      )}

      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="submit" disabled={submitting || (!createdReference && (quoting || !ready || quote?.ok !== true))} className={pill('primary')}>
          {submitting ? t('frontDesk.creatingBooking') : createdReference ? 'Retry document upload' : t('frontDesk.createBooking')}
        </button>
        <button type="button" onClick={onCancel} className={pill('secondary')}>
          {t('frontDesk.cancel')}
        </button>
      </div>
    </form>
  );
}
