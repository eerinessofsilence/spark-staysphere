'use client';

import * as React from 'react';
import { PlusIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { createOrderAction, updateOrderAction, type CreateOrderActionResult } from '@/app/admin/orders/actions';
import type { HotelOrder, OrderCategory, OrderDelivery, OrderPaymentStatus, OrderStatus } from '@/lib/domain/orders';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { lDateRange } from '@/lib/i18n/format';
import { fieldClass, pill } from '@/lib/ui';
import { Modal } from '@/components/site/modal';
import { NativeSelect } from '@/components/ui/native-select';
import { SearchInput } from '@/components/ui/search-input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/admin/shell/toast';

const categories: OrderCategory[] = ['dining', 'wellness', 'experience', 'transport', 'room'];
const deliveries: OrderDelivery[] = ['Without delivery', 'Room delivery', 'Hotel pickup'];
const paymentStatuses: OrderPaymentStatus[] = ['unpaid', 'partial', 'paid'];

const categoryKeys: Record<OrderCategory, AdminTranslationKey> = {
  dining: 'orders.categoryDining',
  wellness: 'orders.categoryWellness',
  experience: 'orders.categoryExperience',
  transport: 'orders.categoryTransport',
  room: 'orders.categoryRoom',
};

function defaultDueValue(): string {
  const value = new Date(Date.now() + 60 * 60 * 1000);
  value.setMinutes(0, 0, 0);
  return localDueValue(value.toISOString());
}

function localDueValue(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

interface OrderBookingChoice {
  reference: string;
  guestName: string;
  email: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
}
interface CreateOrderChoices { guests: string[]; services: string[]; rooms: string[]; bookings: OrderBookingChoice[]; }

export function CreateOrderButton({ guests, services, rooms, bookings, order }: CreateOrderChoices & { order?: HotelOrder }) {
  const t = useAdminT();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => setReady(true), []);
  const close = React.useCallback(() => { if (!busy) setOpen(false); }, [busy]);
  const Icon = order ? PencilSquareIcon : PlusIcon;
  const canEdit = !order || order.status === 'new';
  const editHintId = React.useId();

  return (
    <>
      <div className="flex flex-col items-start gap-2 sm:items-end">
      <button type="button" disabled={!ready || !canEdit} aria-describedby={!canEdit ? editHintId : undefined} onClick={() => { if (canEdit) setOpen(true); }} className={pill('primary')}>
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {t(order ? 'orders.edit' : 'orders.create')}
      </button>
      {!canEdit ? <p id={editHintId} className="max-w-xs text-sm text-muted-foreground sm:text-right">{t('orders.editOnlyNew')}</p> : null}
      </div>
      <Modal open={open && canEdit} onClose={close} title={t(order ? 'orders.edit' : 'orders.createTitle')} className="sm:max-w-2xl">
        {open && canEdit ? <CreateOrderForm order={order} guests={guests} services={services} rooms={rooms} bookings={bookings} onClose={() => setOpen(false)} onBusy={setBusy} /> : null}
      </Modal>
    </>
  );
}

function CreateOrderForm({ guests, services, rooms, bookings, onClose, order, onBusy }: CreateOrderChoices & { onClose: () => void; order?: HotelOrder; onBusy: (busy: boolean) => void }) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const [guestName, setGuestName] = React.useState(order?.guestName ?? '');
  const [roomNumber, setRoomNumber] = React.useState(order?.roomNumber ?? '');
  const [serviceName, setServiceName] = React.useState(order?.serviceName ?? '');
  const [category, setCategory] = React.useState<OrderCategory>(order?.category ?? 'dining');
  const [delivery, setDelivery] = React.useState<OrderDelivery>((order?.delivery as OrderDelivery) ?? 'Without delivery');
  const [dueAt, setDueAt] = React.useState(() => order ? localDueValue(order.dueAt) : defaultDueValue());
  const [total, setTotal] = React.useState(String(order?.total ?? 0));
  const [extras, setExtras] = React.useState(String(order?.extras ?? 0));
  const [paymentStatus, setPaymentStatus] = React.useState<OrderPaymentStatus>(order?.paymentStatus ?? 'unpaid');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [linkBooking, setLinkBooking] = React.useState(Boolean(order?.bookingReference));
  const [bookingQuery, setBookingQuery] = React.useState(order?.bookingReference ?? '');
  const [bookingReference, setBookingReference] = React.useState(order?.bookingReference ?? '');
  const selectedBooking = bookings.find((booking) => booking.reference === bookingReference);

  function chooseBooking(reference: string) {
    const booking = bookings.find((item) => item.reference === reference);
    setBookingReference(booking?.reference ?? '');
    if (booking) {
      setBookingQuery(booking.reference);
      setGuestName(booking.guestName);
      setRoomNumber(booking.roomNumber);
    } else if (selectedBooking) { setGuestName(''); setRoomNumber(''); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (linkBooking && !selectedBooking) { setError(t('orders.chooseBooking')); return; }
    setSubmitting(true);
    onBusy(true);
    setError('');
    setFieldErrors({});
    const input = {
      guestName,
      roomNumber,
      serviceName,
      category,
      delivery,
      dueAt: order && dueAt === localDueValue(order.dueAt) ? order.dueAt : new Date(dueAt).toISOString(),
      total,
      extras,
      paymentStatus,
      status: 'new' satisfies OrderStatus,
      bookingReference: linkBooking ? bookingReference : undefined,
    };
    const result: CreateOrderActionResult = await (order ? updateOrderAction(order.id, input) : createOrderAction(input)).catch(() => ({ ok: false, message: t('orders.createValidation') }));
    setSubmitting(false);
    onBusy(false);
    if (!result.ok) {
      setError(result.message);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }
    toast.success(result.message);
    onClose();
    if (order) window.location.reload();
  }

  const errorFor = (key: string) => fieldErrors[key]?.[0];

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="flex min-h-11 items-center justify-between gap-4">
        <label htmlFor="order-link-booking" className="cursor-pointer text-sm font-medium">{t('orders.linkBooking')}</label>
        <Switch id="order-link-booking" checked={linkBooking} disabled={submitting} onCheckedChange={(checked) => {
          setLinkBooking(checked);
          setBookingReference('');
          setBookingQuery('');
          setError('');
          if (selectedBooking) { setGuestName(''); setRoomNumber(''); }
        }} />
      </div>
      {linkBooking ? <Field label={t('orders.fieldBooking')} htmlFor="order-booking" error={errorFor('bookingReference')}>
        <SearchInput id="order-booking" autoFocus value={bookingQuery} disabled={submitting || bookings.length === 0}
          placeholder={t('ops.searchPlaceholder')} suggestionsLabel={t('orders.fieldBooking')}
          suggestions={bookings.map((booking) => ({ value: booking.reference, label: `${booking.guestName} · ${booking.reference}`, detail: `${booking.email}${booking.roomNumber ? ` · ${booking.roomNumber}` : ''}` }))}
          onChange={(event) => { setBookingQuery(event.target.value); chooseBooking(event.target.value); }}
          onSuggestionSelect={(item) => chooseBooking(item.value)} />
        {selectedBooking ? <p className="mt-2 text-xs text-muted-foreground">{selectedBooking.guestName} · {lDateRange(selectedBooking.checkIn, selectedBooking.checkOut, locale)}</p> : <p className="mt-2 text-xs text-muted-foreground">{t(bookings.length ? 'orders.chooseBooking' : 'orders.noBookingsAvailable')}</p>}
      </Field> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('orders.fieldGuest')} htmlFor="order-guest" error={errorFor('guestName')}>
          <input id="order-guest" list="order-guests" value={guestName} onChange={(event) => setGuestName(event.target.value)} required readOnly={linkBooking} autoFocus={!linkBooking} className={fieldClass} />
          <datalist id="order-guests">{guests.map((name) => <option key={name} value={name} />)}</datalist>
        </Field>
        <Field label={t('orders.fieldRoom')} htmlFor="order-room" error={errorFor('roomNumber')}>
          <input id="order-room" list="order-rooms" value={roomNumber} onChange={(event) => setRoomNumber(event.target.value)} readOnly={linkBooking} className={fieldClass} />
          <datalist id="order-rooms">{rooms.map((room) => <option key={room} value={room} />)}</datalist>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
        <Field label={t('orders.fieldService')} htmlFor="order-service" error={errorFor('serviceName')}>
          <input id="order-service" list="order-services" value={serviceName} onChange={(event) => setServiceName(event.target.value)} required className={fieldClass} />
          <datalist id="order-services">{services.map((name) => <option key={name} value={name} />)}</datalist>
        </Field>
        <Field label={t('orders.fieldCategory')} htmlFor="order-category" error={errorFor('category')}>
          <NativeSelect id="order-category" value={category} onChange={(event) => setCategory(event.target.value as OrderCategory)}>
            {categories.map((value) => <option key={value} value={value}>{t(categoryKeys[value])}</option>)}
          </NativeSelect>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('orders.fieldDelivery')} htmlFor="order-delivery" error={errorFor('delivery')}>
          <NativeSelect id="order-delivery" value={delivery} onChange={(event) => setDelivery(event.target.value as OrderDelivery)}>
            {deliveries.map((value) => <option key={value} value={value}>{value === 'Room delivery' ? t('orders.roomDelivery') : value === 'Hotel pickup' ? t('orders.hotelPickup') : t('orders.withoutDelivery')}</option>)}
          </NativeSelect>
        </Field>
        <Field label={t('orders.fieldDue')} htmlFor="order-due" error={errorFor('dueAt')}>
          <input id="order-due" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} required className={fieldClass} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('orders.fieldTotal')} htmlFor="order-total" error={errorFor('total')}>
          <input id="order-total" type="number" min="0" step="0.01" value={total} onChange={(event) => setTotal(event.target.value)} required className={fieldClass} />
        </Field>
        <Field label={t('orders.fieldExtras')} htmlFor="order-extras" error={errorFor('extras')}>
          <input id="order-extras" type="number" min="0" max="99" step="1" value={extras} onChange={(event) => setExtras(event.target.value)} required className={fieldClass} />
        </Field>
        <Field label={t('orders.fieldPayment')} htmlFor="order-payment" error={errorFor('paymentStatus')}>
          <NativeSelect id="order-payment" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as OrderPaymentStatus)}>
            {paymentStatuses.map((value) => <option key={value} value={value}>{value === 'paid' ? t('orders.paid') : value === 'partial' ? t('orders.partial') : t('orders.unpaid')}</option>)}
          </NativeSelect>
        </Field>
      </div>

      {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" disabled={submitting} onClick={onClose} className={pill('secondary')}>{t('frontDesk.cancel')}</button>
        <button type="submit" disabled={submitting || (linkBooking && !selectedBooking)} className={pill('primary')}>{submitting ? t(order ? 'orders.saving' : 'orders.creating') : t(order ? 'orders.save' : 'orders.create')}</button>
      </div>
    </form>
  );
}

function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm text-muted-foreground">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
