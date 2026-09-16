'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppleLogo, Bank, CreditCard, GoogleLogo, Lock, Warning } from '@phosphor-icons/react/dist/ssr';
import { ArrowLeftIcon, ArrowPathIcon, ArrowRightIcon, CheckIcon } from '@heroicons/react/24/outline';
import { confirmBooking, quoteStay } from '@/app/book/[slug]/actions';
import { buildQuery } from '@/lib/application/search-params';
import type {
  AddOn,
  Guest,
  Hotel,
  PaymentMethod,
  Quote,
  RatePlan,
  RoomType,
  StayCriteria,
} from '@/lib/domain/schemas';
import { useLocale, useT } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n/dictionaries';
import {
  lAddOnCategory,
  lDateRange,
  lFacade,
  lFloor,
  lGuests,
  lMoney,
  lNights,
  lPaymentMethod,
  lRoomNumber,
  lView,
} from '@/lib/i18n/format';
import { Checkbox } from '@/components/ui/checkbox';
import { coverPhoto } from '@/lib/domain/room-attributes';
import { facadeOf } from '@/lib/domain/room-units';
import { AddOnCatalog } from '@/components/rooms/add-on-catalog';
import { featureIcon, tintInk, tintSurface, type AmenityTone } from '@/components/rooms/feature-icon';
import { BillRow } from '@/components/rooms/add-on-picker';
import { StepRail } from '@/components/booking/step-rail';
import { countryByIso, DEFAULT_COUNTRY_ISO, PhoneField } from '@/components/booking/phone-field';
import { StayDatesSummary } from '@/components/search/stay-dates-summary';
import { GuestsField } from '@/components/search/guests-field';
import { StayDatesField } from '@/components/search/stay-dates-field';
import { fieldClass, pill } from '@/lib/ui';
import { StatusBadge } from '@/components/rooms/status-badge';
import { cn } from '@/lib/utils';

/** Ids only, for typing the flow's step state; labels are localized inside the component. */
const STEP_IDS = ['stay', 'room', 'services', 'guest', 'payment', 'review'] as const;

/**
 * The methods a European property's booking engine actually offers, named as
 * the guest knows them rather than as one vague "wallet". Every one of them
 * is simulated here — the banner above says so — but the choice is real: it
 * reaches the server, and the two that take nothing at booking time record a
 * pending payment instead of a fake authorization.
 */
const PAYMENT_METHOD_META: { id: PaymentMethod; hintKey: TranslationKey; icon: typeof CreditCard; tone: AmenityTone }[] = [
  { id: 'card', hintKey: 'book.cardHint', icon: CreditCard, tone: 'clay' },
  { id: 'apple_pay', hintKey: 'book.applePayHint', icon: AppleLogo, tone: 'stone' },
  { id: 'google_pay', hintKey: 'book.googlePayHint', icon: GoogleLogo, tone: 'sage' },
  { id: 'bank_transfer', hintKey: 'book.bankTransferHint', icon: Bank, tone: 'sand' },
  { id: 'pay_at_hotel', hintKey: 'book.payAtHotelHint', icon: Lock, tone: 'rose' },
];

interface BookingFlowProps {
  hotel: Hotel;
  room: RoomType;
  ratePlan: RatePlan;
  addOns: AddOn[];
  criteria: StayCriteria;
  initialQuote: Quote;
  initialAddOnIds: string[];
  minDate: string;
  /** A room the guest picked on the floor plan, already checked free for the stay. */
  roomNumber?: string | null;
}

type FlowError = {
  code: string;
  message: string;
  currentTotal?: number;
};

/**
 * The server's own error messages are always English — see `app/book/[slug]/actions.ts`
 * and the `BookingError` codes it forwards. Showing them directly would leak untranslated
 * text into the guest's chosen language, so the code alone picks the localized copy; the
 * one place a dynamic detail (a room number) matters, `flowError.code === 'unavailable'`,
 * already renders its own translated CTA row alongside this generic message.
 */
const BOOKING_ERROR_KEYS: Record<string, TranslationKey> = {
  invalid_request: 'book.errorInvalidRequest',
  unavailable: 'book.errorRoomUnavailable',
  price_changed: 'book.errorPriceChanged',
  payment_declined: 'book.errorPaymentDeclined',
  not_found: 'book.errorNotFound',
  quote_failed: 'book.errorQuoteFailed',
};

export function BookingFlow({
  hotel,
  room,
  ratePlan,
  addOns,
  criteria: initialCriteria,
  initialQuote,
  initialAddOnIds,
  minDate,
  roomNumber: initialRoomNumber = null,
}: BookingFlowProps) {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();

  const steps = React.useMemo(
    () =>
      [
        { id: STEP_IDS[0], label: t('book.stepYourStay') },
        { id: STEP_IDS[1], label: t('book.stepRoomAndRate') },
        // "Extras" rather than "Services": the step now holds the kitchen's
        // list too, and the panel heading is this label, so it would
        // otherwise repeat the group.
        { id: STEP_IDS[2], label: t('book.stepExtras') },
        { id: STEP_IDS[3], label: t('book.stepGuestDetails') },
        { id: STEP_IDS[4], label: t('book.stepPayment') },
        { id: STEP_IDS[5], label: t('book.stepReview') },
      ] as const,
    [t],
  );

  const paymentMethods = React.useMemo(
    () =>
      PAYMENT_METHOD_META.map((meta) => ({
        ...meta,
        label: lPaymentMethod(meta.id, locale),
        hint: t(meta.hintKey),
      })),
    [t, locale],
  );

  const [stepIndex, setStepIndex] = React.useState(0);
  const [criteria, setCriteria] = React.useState(initialCriteria);
  const [addOnIds, setAddOnIds] = React.useState(initialAddOnIds);
  const [quote, setQuote] = React.useState(initialQuote);
  const [repricing, setRepricing] = React.useState(false);
  const [guest, setGuest] = React.useState<Guest>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  // The dial code and the digits the guest actually typed are tracked apart
  // from `guest.phone` (the one field the server and the review step read):
  // composing them on every change keeps that single field always correct
  // instead of teaching every reader of `guest` about a country/number split.
  const [phoneCountry, setPhoneCountry] = React.useState(DEFAULT_COUNTRY_ISO);
  const [phoneNational, setPhoneNational] = React.useState('');
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('card');
  const [acceptedTerms, setAcceptedTerms] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [flowError, setFlowError] = React.useState<FlowError | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [roomNumber, setRoomNumber] = React.useState<string | null>(initialRoomNumber);
  // Held across retries so a resubmitted booking is never duplicated.
  const idempotencyKey = React.useRef<string | null>(null);

  const step: (typeof steps)[number]['id'] = steps[stepIndex]!.id;
  const guests = criteria.adults + criteria.children;
  const overCapacity = guests > room.capacity;
  const datesInvalid = criteria.checkOut <= criteria.checkIn;
  const blocked = !quote.available || overCapacity || datesInvalid;

  /** Any change to the stay or services is re-priced by the server, never locally. */
  const reprice = React.useCallback(
    async (nextCriteria: StayCriteria, nextAddOnIds: string[]) => {
      if (nextCriteria.checkOut <= nextCriteria.checkIn) return;
      setRepricing(true);
      const result = await quoteStay({
        roomSlug: room.slug,
        checkIn: nextCriteria.checkIn,
        checkOut: nextCriteria.checkOut,
        adults: nextCriteria.adults,
        children: nextCriteria.children,
        addOnIds: nextAddOnIds,
      });
      setRepricing(false);
      if (result.ok) {
        setQuote(result.quote);
        setFlowError(null);
      } else {
        setFlowError({ code: 'quote_failed', message: result.message });
      }
    },
    [room.slug],
  );

  const updateCriteria = (patch: Partial<StayCriteria>) => {
    const next = { ...criteria, ...patch };
    if (next.checkOut <= next.checkIn) next.checkOut = addOneDay(next.checkIn);
    setCriteria(next);
    void reprice(next, addOnIds);
  };

  const changeAddOns = (next: string[]) => {
    setAddOnIds(next);
    void reprice(criteria, next);
  };

  /** Dropped from the summary: the line, and anything sold only inside it. */
  const removeAddOn = (addOnId: string) => {
    const alsoGoing = new Set(
      quote.price.addOnLines.filter((line) => line.parentId === addOnId).map((line) => line.addOnId),
    );
    changeAddOns(addOnIds.filter((id) => id !== addOnId && !alsoGoing.has(id)));
  };

  const validateGuest = (): boolean => {
    const errors: Record<string, string[]> = {};
    if (guest.firstName.trim().length < 1) errors.firstName = [t('book.enterFirstNameError')];
    if (guest.lastName.trim().length < 1) errors.lastName = [t('book.enterLastNameError')];
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guest.email)) {
      errors.email = [t('book.enterEmailError')];
    }
    // Digits typed after the country code, not the composed `guest.phone` —
    // otherwise a longer dial code (+971) buys the guest a shorter real
    // number and a shorter one (+1) demands a longer one, for no reason
    // tied to whether the number itself is real.
    if (phoneNational.replace(/\D/g, '').length < 7) {
      errors.phone = [t('book.enterPhoneError')];
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const canAdvance = (): boolean => {
    if (step === 'guest') return validateGuest();
    if (step === 'payment') return acceptedTerms;
    return !blocked;
  };

  const goNext = () => {
    if (!canAdvance()) return;
    setStepIndex((index) => Math.min(steps.length - 1, index + 1));
  };

  const goBack = () => setStepIndex((index) => Math.max(0, index - 1));

  const submit = async () => {
    if (!validateGuest()) {
      setStepIndex(steps.findIndex((entry) => entry.id === 'guest'));
      return;
    }
    idempotencyKey.current ??= crypto.randomUUID();
    setSubmitting(true);
    setFlowError(null);

    const result = await confirmBooking({
      roomSlug: room.slug,
      checkIn: criteria.checkIn,
      checkOut: criteria.checkOut,
      adults: criteria.adults,
      children: criteria.children,
      addOnIds,
      guest,
      expectedTotal: quote.price.total,
      paymentMethod,
      unitNumber: roomNumber ?? undefined,
      idempotencyKey: idempotencyKey.current,
    });

    if (result.ok) {
      router.push(`/booking/${result.reference}`);
      return;
    }

    setSubmitting(false);
    setFlowError({
      code: result.code,
      message: result.message,
      currentTotal: result.currentTotal,
    });
    if (result.fieldErrors) {
      // The server's own field messages are Zod defaults, always in English;
      // translated one-for-one by field name instead of shown as-is.
      const fieldErrorKeys: Record<string, TranslationKey> = {
        firstName: 'book.enterFirstNameError',
        lastName: 'book.enterLastNameError',
        email: 'book.enterEmailError',
        phone: 'book.enterPhoneError',
      };
      setFieldErrors(
        Object.fromEntries(
          Object.keys(result.fieldErrors).map((field) => [
            field,
            [t(fieldErrorKeys[field] ?? 'book.errorGeneric')],
          ]),
        ),
      );
      setStepIndex(steps.findIndex((entry) => entry.id === 'guest'));
    }
    // A changed price invalidates the attempt; the next try needs a fresh key.
    if (result.code === 'price_changed' || result.code === 'unavailable') {
      idempotencyKey.current = null;
      await reprice(criteria, addOnIds);
    }
  };

  const stayQuery = buildQuery({ criteria, addOnIds });
  // The arrival area is the hotel's own exterior; fall back to whatever area
  // the property leads with if that one is ever renamed.
  const hotelPhoto = (hotel.areas.find((area) => area.id === 'hotel') ?? hotel.areas[0])?.photo;

  // Services and the kitchen are shown apart: booking a transfer and ordering
  // dinner are different decisions, even though one total pays for both.
  const onSale = addOns.filter((addOn) => addOn.enabled);
  const addOnGroups = (['service', 'dining'] as const)
    .map((category) => [category, onSale.filter((addOn) => addOn.category === category)] as const)
    .filter(([, items]) => items.some((addOn) => !addOn.parentId));

  return (
    <div className="grid grid-cols-1 gap-y-8 gap-x-gutter lg:grid-cols-sidebar">
      <div className="min-w-0">
        <StepRail steps={steps} current={stepIndex} onSelect={setStepIndex} className="mb-8" />

        {flowError ? (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-3xl border border-warning/30 bg-warning/10 p-4"
          >
            <Warning weight="fill" className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-medium">{t(BOOKING_ERROR_KEYS[flowError.code] ?? 'book.errorGeneric')}</p>
              {flowError.currentTotal !== undefined ? (
                <p className="mt-1 text-muted-foreground">
                  {t('book.currentTotalIs', { total: lMoney(flowError.currentTotal, quote.price.currency, locale) })}
                </p>
              ) : null}
              {flowError.code === 'unavailable' && roomNumber ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/rooms?${buildQuery({ criteria, layout: 'plan' })}`} className={pill('secondary')}>
                    {t('book.pickAnotherRoomPlan')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setRoomNumber(null);
                      setFlowError(null);
                    }}
                    className={pill('secondary')}
                  >
                    {t('book.bookAnyInstead', { room: room.name })}
                  </button>
                </div>
              ) : null}
              {flowError.code === 'unavailable' && !roomNumber ? (
                <Link
                  href={`/rooms?${stayQuery}`}
                  className="mt-3 inline-flex min-h-11 items-center rounded-full border border-border bg-card px-5 font-medium"
                >
                  {t('book.findAnotherRoom')}
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        {!quote.available && !flowError ? (
          <div
            role="alert"
            className="mb-6 rounded-3xl border border-danger/25 bg-danger/10 p-4 text-sm"
          >
            <p className="font-medium text-danger">
              {t('book.fullyBookedForDates', {
                room: room.name,
                dateRange: lDateRange(criteria.checkIn, criteria.checkOut, locale),
              })}
            </p>
            <p className="mt-1 text-muted-foreground">{t('book.changeDatesOrPickAnother')}</p>
            <Link
              href={`/rooms?${stayQuery}`}
              className="mt-3 inline-flex min-h-11 items-center rounded-full border border-border bg-card px-5 font-medium"
            >
              {t('book.seeAvailableRooms')}
            </Link>
          </div>
        ) : null}

        <section aria-labelledby="step-heading" className="rounded-[18px] bg-card p-5 shadow-soft sm:p-7">
          <h2 id="step-heading" className="text-display text-2xl">
            {steps[stepIndex]!.label}
          </h2>

          {step === 'stay' ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <StayDatesField
                variant="stacked"
                checkIn={criteria.checkIn}
                checkOut={criteria.checkOut}
                minDate={minDate}
                onChange={(dates) => updateCriteria(dates)}
                error={datesInvalid ? t('book.checkOutAfterCheckIn') : undefined}
              />
              <GuestsField
                id="book-guests"
                adults={criteria.adults}
                children={criteria.children}
                onChange={(guests) => updateCriteria(guests)}
                variant="stacked"
                error={
                  overCapacity
                    ? t('book.sleepsUpToGuests', { room: room.name, n: String(room.capacity) })
                    : undefined
                }
              />
            </div>
          ) : null}

          {step === 'room' ? (
            <div className="mt-5">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="aspect-[4/3] w-full overflow-hidden rounded-3xl bg-stone sm:w-64">
                  {coverPhoto(room) ? (
                    <img
                      src={coverPhoto(room)!.url}
                      alt={room.name}
                      width={coverPhoto(room)!.width}
                      height={coverPhoto(room)!.height}
                      className="size-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-display text-2xl">{room.name}</h3>
                    <StatusBadge status={quote.status} remaining={quote.remaining} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {room.areaM2} m² · {lView(room.view, locale)} ·{' '}
                    {t('room.sleepsUpTo', { n: String(room.capacity) })}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {room.description}
                  </p>
                  <Link
                    href={`/rooms?${stayQuery}`}
                    className={pill('secondary', 'mt-4')}
                  >
                    {t('book.changeRoom')}
                  </Link>
                </div>
              </div>

              <div className="mt-6 rounded-3xl bg-stone/60 p-5">
                <h4 className="font-sans text-sm font-medium tracking-normal">{ratePlan.name}</h4>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {ratePlan.includedServices.map((service) => {
                    const Icon = featureIcon(service);
                    return (
                      <li key={service} className="flex items-start gap-2.5 text-sm">
                        <Icon
                          weight="fill"
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        {service}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
                  {ratePlan.cancellationPolicy}
                </p>
              </div>
            </div>
          ) : null}

          {step === 'services' ? (
            <div className="mt-5 grid gap-8" aria-busy={repricing}>
              {onSale.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  {t('book.noExtraServices')}
                </p>
              ) : (
                addOnGroups.map(([category, items]) => (
                  <div key={category} role="group" aria-labelledby={`flow-addons-${category}`}>
                    <h3
                      id={`flow-addons-${category}`}
                      className="font-sans text-sm font-medium tracking-normal"
                    >
                      {lAddOnCategory(category, locale)}
                    </h3>
                    <div className="mt-3">
                      <AddOnCatalog
                        idPrefix="flow-addon"
                        addOns={items}
                        selected={addOnIds}
                        onChange={changeAddOns}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {step === 'guest' ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <LabelledField id="guest-first" label={t('book.firstName')} error={fieldErrors.firstName?.[0]}>
                <input
                  id="guest-first"
                  autoComplete="given-name"
                  placeholder={t('book.enterFirstName')}
                  value={guest.firstName}
                  aria-invalid={Boolean(fieldErrors.firstName)}
                  onChange={(event) =>
                    setGuest((current) => ({ ...current, firstName: event.target.value }))
                  }
                  className={fieldClass}
                />
              </LabelledField>
              <LabelledField id="guest-last" label={t('book.lastName')} error={fieldErrors.lastName?.[0]}>
                <input
                  id="guest-last"
                  autoComplete="family-name"
                  placeholder={t('book.enterLastName')}
                  value={guest.lastName}
                  aria-invalid={Boolean(fieldErrors.lastName)}
                  onChange={(event) =>
                    setGuest((current) => ({ ...current, lastName: event.target.value }))
                  }
                  className={fieldClass}
                />
              </LabelledField>
              <LabelledField id="guest-email" label={t('book.email')} error={fieldErrors.email?.[0]}>
                <input
                  id="guest-email"
                  type="email"
                  autoComplete="email"
                  placeholder={t('book.enterEmail')}
                  value={guest.email}
                  aria-invalid={Boolean(fieldErrors.email)}
                  onChange={(event) =>
                    setGuest((current) => ({ ...current, email: event.target.value }))
                  }
                  className={fieldClass}
                />
              </LabelledField>
              <LabelledField id="guest-phone" label={t('book.phone')} error={fieldErrors.phone?.[0]}>
                <PhoneField
                  id="guest-phone"
                  countryIso={phoneCountry}
                  nationalNumber={phoneNational}
                  invalid={Boolean(fieldErrors.phone)}
                  onCountryChange={(iso) => {
                    setPhoneCountry(iso);
                    setGuest((current) => ({
                      ...current,
                      phone: `${countryByIso(iso).dial} ${phoneNational}`.trim(),
                    }));
                  }}
                  onNationalNumberChange={(value) => {
                    setPhoneNational(value);
                    setGuest((current) => ({
                      ...current,
                      phone: `${countryByIso(phoneCountry).dial} ${value}`.trim(),
                    }));
                  }}
                />
              </LabelledField>
              <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">
                {t('book.guestDataNotice')}
              </p>
            </div>
          ) : null}

          {step === 'payment' ? (
            <div className="mt-5">
              <p className="rounded-3xl bg-accent-soft p-4 text-sm text-accent-strong">
                <span className="font-medium">{t('book.demoPaymentTitle')}</span> {t('book.demoPaymentBody')}
              </p>
              <fieldset className="mt-5">
                <legend className="text-sm font-medium">{t('book.paymentMethod')}</legend>
                {/* The same tile the extras step sells services from: a seated
                    glyph, the name, one line of hint. Two across from `sm` and
                    three from `lg` — five methods in a single row of three
                    left two orphans and squeezed every hint to three lines.
                    The radio itself is off-screen; the edge and tick carry
                    the selection. */}
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {paymentMethods.map((method) => {
                    const selected = paymentMethod === method.id;
                    return (
                      <label
                        key={method.id}
                        htmlFor={`pay-${method.id}`}
                        className={cn(
                          'relative flex cursor-pointer items-start gap-3 rounded-[14px] border bg-card p-4 pr-12 transition-colors',
                          selected ? 'border-primary' : 'border-border hover:bg-stone/60',
                        )}
                      >
                        <input
                          id={`pay-${method.id}`}
                          type="radio"
                          name="payment-method"
                          value={method.id}
                          checked={selected}
                          onChange={() => setPaymentMethod(method.id)}
                          className="sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className={cn(
                            'grid size-11 shrink-0 place-items-center rounded-2xl',
                            tintSurface[method.tone],
                          )}
                        >
                          <method.icon weight="fill" className={cn('size-5', tintInk[method.tone])} />
                        </span>
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="text-display text-base leading-tight">{method.label}</span>
                          <span className="text-sm leading-snug text-muted-foreground">{method.hint}</span>
                        </span>
                        {selected ? (
                          <span
                            aria-hidden="true"
                            className="absolute top-3 right-3 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground"
                          >
                            <CheckIcon className="size-3.5 stroke-[2.5]" />
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <label
                htmlFor="accept-terms"
                className="mt-5 flex cursor-pointer items-start gap-3 text-sm"
              >
                <Checkbox
                  id="accept-terms"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked)}
                  className="mt-0.5 size-5 rounded-full"
                />
                <span>
                  {t('book.acceptTermsPrefix')} {ratePlan.cancellationPolicy.toLowerCase()}
                </span>
              </label>
              {!acceptedTerms ? (
                <p className="mt-2 text-xs text-muted-foreground">{t('book.tickToContinue')}</p>
              ) : null}
            </div>
          ) : null}

          {step === 'review' ? (
            <div className="mt-5">
              <dl className="grid gap-4">
              <ReviewRow label={t('book.reviewStay')}>
                {lDateRange(criteria.checkIn, criteria.checkOut, locale)} ·{' '}
                {lNights(quote.price.nights, locale)}
              </ReviewRow>
              <ReviewRow label={t('book.reviewGuests')}>
                {lGuests(criteria.adults, criteria.children, locale)}
              </ReviewRow>
              <ReviewRow label={t('book.reviewRoom')}>
                {room.name}
                {roomNumber ? `, ${lRoomNumber(roomNumber, locale)}` : ''}, {ratePlan.name}
              </ReviewRow>
              <ReviewRow label={t('book.reviewServices')}>
                {quote.price.addOnLines.length
                  ? quote.price.addOnLines.map((line) => line.name).join(', ')
                  : t('book.reviewNone')}
              </ReviewRow>
              <ReviewRow label={t('book.reviewGuest')}>
                {guest.firstName} {guest.lastName} · {guest.email} · {guest.phone}
              </ReviewRow>
              <ReviewRow label={t('book.reviewPayment')}>
                {paymentMethods.find((method) => method.id === paymentMethod)?.label} ({t('book.demo')})
              </ReviewRow>
              <ReviewRow label={t('book.reviewTotal')}>
                <span className="font-medium">
                  {lMoney(quote.price.total, quote.price.currency, locale)}
                </span>
              </ReviewRow>
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                {t('book.priceRecheckNotice')}
              </p>
            </div>
          ) : null}

          <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIndex === 0 || submitting}
              className={pill('secondary')}
            >
              <ArrowLeftIcon className="size-4" aria-hidden="true" />
              {t('book.back')}
            </button>

            {step === 'review' ? (
              <button
                type="button"
                onClick={submit}
                disabled={submitting || repricing || blocked}
                className={pill('primary', 'min-h-12 px-6')}
              >
                {submitting ? (
                  <>
                    <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" />
                    {t('book.confirming')}
                  </>
                ) : (
                  <>
                    {t('book.confirmDemoBooking')}
                    <ArrowRightIcon className="size-4" aria-hidden="true" />
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={repricing || (step !== 'guest' && step !== 'payment' && blocked)}
                className={pill('primary', 'min-h-12 px-6')}
              >
                {t('book.continue')}
                <ArrowRightIcon className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </section>
      </div>

      <aside aria-labelledby="booking-summary-heading" className="lg:sticky lg:top-24 lg:h-fit">
        <div className="overflow-hidden rounded-[18px] bg-card shadow-soft">
          {/* The property itself, above its own name: the same facade the
              arrival page opens on, so the card is recognisably Asteria Cove
              and not a white receipt. The room's own photograph belongs to
              the "Room & rate" step, where the choice is still open. */}
          {hotelPhoto ? (
            <img
              src={hotelPhoto.url}
              alt={hotelPhoto.alt}
              width={hotelPhoto.width}
              height={hotelPhoto.height}
              loading="lazy"
              decoding="async"
              className="aspect-[16/9] w-full object-cover"
            />
          ) : null}

          <div className="p-6">
          <h2 id="booking-summary-heading" className="text-display text-2xl">
            {room.name}
          </h2>
          <p className="text-sm text-muted-foreground">{hotel.name}</p>
          {roomNumber ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 rounded-2xl bg-stone/60 py-1 pr-1 pl-3 text-sm">
              <span>
                <span className="font-medium">{lRoomNumber(roomNumber, locale)}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {lFloor(room.floor, locale)}, {lFacade(facadeOf(room.view), locale)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setRoomNumber(null)}
                className="min-h-11 cursor-pointer rounded-full px-3 font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                {t('book.anyRoomInstead')}
              </button>
            </div>
          ) : null}

          <StayDatesSummary checkIn={criteria.checkIn} checkOut={criteria.checkOut} className="mt-4" />
          <p className="mt-2 text-sm text-muted-foreground">
            {lNights(quote.price.nights, locale)} · {lGuests(criteria.adults, criteria.children, locale)}
          </p>

          <div
            aria-live="polite"
            aria-busy={repricing}
            className={cn('mt-4 border-t border-border pt-4', repricing && 'opacity-60')}
          >
            <dl className="grid gap-2 text-sm">
              <BillRow
                label={`${lMoney(quote.price.nightlyPrice, quote.price.currency, locale)} × ${lNights(quote.price.nights, locale)}`}
                value={lMoney(quote.price.roomTotal, quote.price.currency, locale)}
              />
              {quote.price.addOnLines.map((line) => (
                <BillRow
                  key={line.addOnId}
                  indented={Boolean(line.parentId)}
                  onRemove={() => removeAddOn(line.addOnId)}
                  removeLabel={t('room.remove', { name: line.name })}
                  label={`${line.name}${line.quantity > 1 ? ` × ${line.quantity}` : ''}`}
                  value={lMoney(line.total, quote.price.currency, locale)}
                />
              ))}
              <BillRow
                label={t('room.taxesAndFees')}
                value={lMoney(quote.price.taxesAndFees, quote.price.currency, locale)}
              />
            </dl>

            <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-border pt-4">
              <span className="text-sm font-medium">{t('room.total')}</span>
              {/* Same card as the room page's "Your stay" sidebar — same size,
                  so the total doesn't quietly grow or shrink between the two
                  steps of the same decision. */}
              <span className="text-display text-[2rem]">
                {lMoney(quote.price.total, quote.price.currency, locale)}
              </span>
            </div>
            {repricing ? (
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <ArrowPathIcon className="size-3.5 animate-spin" aria-hidden="true" />
                {t('room.repricingYourStay')}
              </p>
            ) : null}
          </div>

          <p className="mt-4 rounded-2xl bg-stone/60 p-3 text-xs leading-relaxed text-muted-foreground">
            {t('book.demoBookingFooter')}
          </p>
          </div>
        </div>
      </aside>
    </div>
  );
}


function ReviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border pb-3 last:border-b-0 sm:grid-cols-[8rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function LabelledField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm text-muted-foreground">
        {label}
      </label>
      {children}
      {error && error.trim() ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function addOneDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
