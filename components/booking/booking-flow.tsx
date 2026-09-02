'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleNotch,
  CreditCard,
  Lock,
  Wallet,
  Warning,
} from '@phosphor-icons/react/dist/ssr';
import { confirmBooking, quoteStay } from '@/app/book/[slug]/actions';
import { buildQuery } from '@/lib/application/search-params';
import type { AddOn, Guest, Hotel, Quote, RatePlan, RoomType, StayCriteria } from '@/lib/domain/schemas';
import {
  formatDateRange,
  formatGuests,
  formatMoney,
  formatNights,
  viewLabels,
} from '@/lib/formatting';
import { Checkbox } from '@/components/ui/checkbox';
import { coverPhoto } from '@/lib/domain/room-attributes';
import { AddOnRow } from '@/components/rooms/add-on-picker';
import { StayDatesField } from '@/components/search/stay-dates-field';
import { fieldClass, pill } from '@/lib/ui';
import { StatusBadge } from '@/components/rooms/status-badge';
import { cn } from '@/lib/utils';

const steps = [
  { id: 'stay', label: 'Your stay' },
  { id: 'room', label: 'Room & rate' },
  { id: 'services', label: 'Services' },
  { id: 'guest', label: 'Guest details' },
  { id: 'payment', label: 'Payment' },
  { id: 'review', label: 'Review' },
] as const;

const paymentMethods = [
  {
    id: 'demo_card',
    label: 'Demo card',
    hint: 'Simulated authorization. No card fields, no card data.',
    icon: CreditCard,
  },
  {
    id: 'demo_wallet',
    label: 'Demo wallet',
    hint: 'Stands in for Apple Pay or Google Pay in production.',
    icon: Wallet,
  },
  {
    id: 'pay_at_hotel',
    label: 'Pay at the hotel',
    hint: 'Guarantee the room now, settle the balance on arrival.',
    icon: Lock,
  },
] as const;

type PaymentMethodId = (typeof paymentMethods)[number]['id'];

interface BookingFlowProps {
  hotel: Hotel;
  room: RoomType;
  ratePlan: RatePlan;
  addOns: AddOn[];
  criteria: StayCriteria;
  initialQuote: Quote;
  initialAddOnIds: string[];
  minDate: string;
}

type FlowError = {
  code: string;
  message: string;
  currentTotal?: number;
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
}: BookingFlowProps) {
  const router = useRouter();
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
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethodId>('demo_card');
  const [acceptedTerms, setAcceptedTerms] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [flowError, setFlowError] = React.useState<FlowError | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
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

  const toggleAddOn = (id: string) => {
    const next = addOnIds.includes(id)
      ? addOnIds.filter((entry) => entry !== id)
      : [...addOnIds, id];
    setAddOnIds(next);
    void reprice(criteria, next);
  };

  const validateGuest = (): boolean => {
    const errors: Record<string, string[]> = {};
    if (guest.firstName.trim().length < 1) errors.firstName = ['Enter a first name.'];
    if (guest.lastName.trim().length < 1) errors.lastName = ['Enter a last name.'];
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(guest.email)) {
      errors.email = ['Enter an email we can send the confirmation to.'];
    }
    if (guest.phone.replace(/\D/g, '').length < 7) {
      errors.phone = ['Enter a phone number with at least 7 digits.'];
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
      setFieldErrors(result.fieldErrors);
      setStepIndex(steps.findIndex((entry) => entry.id === 'guest'));
    }
    // A changed price invalidates the attempt; the next try needs a fresh key.
    if (result.code === 'price_changed' || result.code === 'unavailable') {
      idempotencyKey.current = null;
      await reprice(criteria, addOnIds);
    }
  };

  const stayQuery = buildQuery({ criteria, addOnIds });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-10">
      <div className="min-w-0">
        <ol className="mb-8 flex flex-wrap gap-x-2 gap-y-2" aria-label="Booking steps">
          {steps.map((entry, index) => {
            const state = index === stepIndex ? 'current' : index < stepIndex ? 'done' : 'todo';
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  aria-current={state === 'current' ? 'step' : undefined}
                  disabled={index > stepIndex}
                  onClick={() => setStepIndex(index)}
                  className={cn(
                    'flex min-h-11 items-center gap-2 rounded-full border px-3 pr-4 text-sm font-medium transition-colors',
                    state === 'current' && 'border-ink bg-ink text-[#F7F5F0]',
                    state === 'done' && 'border-border bg-card hover:bg-stone',
                    state === 'todo' && 'border-dashed border-border text-muted-foreground',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid size-5 place-items-center rounded-full text-[11px] font-bold',
                      state === 'current' && 'bg-accent text-white',
                      state === 'done' && 'bg-success/15 text-success',
                      state === 'todo' && 'bg-stone text-muted-foreground',
                    )}
                  >
                    {state === 'done' ? <Check weight="bold" className="size-3" /> : index + 1}
                  </span>
                  {entry.label}
                </button>
              </li>
            );
          })}
        </ol>

        {flowError ? (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-3xl border border-warning/30 bg-warning/10 p-4"
          >
            <Warning weight="fill" className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-medium">{flowError.message}</p>
              {flowError.currentTotal !== undefined ? (
                <p className="mt-1 text-muted-foreground">
                  The current total is{' '}
                  {formatMoney(flowError.currentTotal, quote.price.currency)}. Review it in the
                  summary and confirm again.
                </p>
              ) : null}
              {flowError.code === 'unavailable' ? (
                <Link
                  href={`/rooms?${stayQuery}`}
                  className="mt-3 inline-flex min-h-11 items-center rounded-full border border-border bg-card px-5 font-medium"
                >
                  Find another room
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
              The {room.name} is sold out for {formatDateRange(criteria.checkIn, criteria.checkOut)}.
            </p>
            <p className="mt-1 text-muted-foreground">
              Change your dates below, or pick another room.
            </p>
            <Link
              href={`/rooms?${stayQuery}`}
              className="mt-3 inline-flex min-h-11 items-center rounded-full border border-border bg-card px-5 font-medium"
            >
              See available rooms
            </Link>
          </div>
        ) : null}

        <section aria-labelledby="step-heading" className="rounded-[28px] bg-card p-5 shadow-soft sm:p-7">
          <h2 id="step-heading" className="text-display text-2xl">
            {steps[stepIndex]!.label}
          </h2>

          {step === 'stay' ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <StayDatesField
                variant="stacked"
                checkIn={criteria.checkIn}
                checkOut={criteria.checkOut}
                minDate={minDate}
                onChange={(dates) => updateCriteria(dates)}
                error={datesInvalid ? 'Check-out must be after check-in.' : undefined}
              />
              <LabelledField id="book-adults" label="Adults">
                <select
                  id="book-adults"
                  value={criteria.adults}
                  onChange={(event) => updateCriteria({ adults: Number(event.target.value) })}
                  className={fieldClass}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </LabelledField>
              <LabelledField
                id="book-children"
                label="Children"
                error={
                  overCapacity
                    ? `The ${room.name} sleeps up to ${room.capacity} guests.`
                    : undefined
                }
              >
                <select
                  id="book-children"
                  value={criteria.children}
                  onChange={(event) => updateCriteria({ children: Number(event.target.value) })}
                  className={fieldClass}
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </LabelledField>
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
                    {room.areaM2} m² · {viewLabels[room.view]} · sleeps up to {room.capacity}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {room.description}
                  </p>
                  <Link
                    href={`/rooms?${stayQuery}`}
                    className={pill('secondary', 'mt-4')}
                  >
                    Change room
                  </Link>
                </div>
              </div>

              <div className="mt-6 rounded-3xl bg-stone/60 p-5">
                <h4 className="font-sans text-sm font-medium tracking-normal">{ratePlan.name}</h4>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {ratePlan.includedServices.map((service) => (
                    <li key={service} className="flex items-start gap-2 text-sm">
                      <Check weight="bold" className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                      {service}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
                  {ratePlan.cancellationPolicy}
                </p>
              </div>
            </div>
          ) : null}

          {step === 'services' ? (
            <div className="mt-5 grid gap-3" aria-busy={repricing}>
              {addOns.filter((addOn) => addOn.enabled).length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  No extra services are on sale for this stay.
                </p>
              ) : (
                addOns
                  .filter((addOn) => addOn.enabled)
                  .map((addOn) => (
                    <AddOnRow
                      key={addOn.id}
                      idPrefix="flow-addon"
                      addOn={addOn}
                      checked={addOnIds.includes(addOn.id)}
                      onToggle={() => toggleAddOn(addOn.id)}
                    />
                  ))
              )}
            </div>
          ) : null}

          {step === 'guest' ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <LabelledField id="guest-first" label="First name" error={fieldErrors.firstName?.[0]}>
                <input
                  id="guest-first"
                  autoComplete="given-name"
                  value={guest.firstName}
                  aria-invalid={Boolean(fieldErrors.firstName)}
                  onChange={(event) =>
                    setGuest((current) => ({ ...current, firstName: event.target.value }))
                  }
                  className={fieldClass}
                />
              </LabelledField>
              <LabelledField id="guest-last" label="Last name" error={fieldErrors.lastName?.[0]}>
                <input
                  id="guest-last"
                  autoComplete="family-name"
                  value={guest.lastName}
                  aria-invalid={Boolean(fieldErrors.lastName)}
                  onChange={(event) =>
                    setGuest((current) => ({ ...current, lastName: event.target.value }))
                  }
                  className={fieldClass}
                />
              </LabelledField>
              <LabelledField id="guest-email" label="Email" error={fieldErrors.email?.[0]}>
                <input
                  id="guest-email"
                  type="email"
                  autoComplete="email"
                  value={guest.email}
                  aria-invalid={Boolean(fieldErrors.email)}
                  onChange={(event) =>
                    setGuest((current) => ({ ...current, email: event.target.value }))
                  }
                  className={fieldClass}
                />
              </LabelledField>
              <LabelledField id="guest-phone" label="Phone" error={fieldErrors.phone?.[0]}>
                <input
                  id="guest-phone"
                  type="tel"
                  autoComplete="tel"
                  value={guest.phone}
                  aria-invalid={Boolean(fieldErrors.phone)}
                  onChange={(event) =>
                    setGuest((current) => ({ ...current, phone: event.target.value }))
                  }
                  className={fieldClass}
                />
              </LabelledField>
              <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">
                Used only to render this demo confirmation. Nothing is emailed, stored beyond the
                current server process, or shared with a third party.
              </p>
            </div>
          ) : null}

          {step === 'payment' ? (
            <div className="mt-5">
              <p className="rounded-3xl bg-accent-soft p-4 text-sm text-accent-strong">
                <span className="font-medium">Demo payment.</span> No card fields are shown and no
                card data is collected. A production build collects payment through the provider's
                own hosted, tokenized fields.
              </p>
              <fieldset className="mt-5">
                <legend className="text-sm font-medium">Payment method</legend>
                <div className="mt-3 grid gap-3">
                  {paymentMethods.map((method) => (
                    <label
                      key={method.id}
                      htmlFor={`pay-${method.id}`}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-3xl border p-4 transition-colors',
                        paymentMethod === method.id ? 'border-ink' : 'border-border hover:bg-stone/60',
                      )}
                    >
                      <input
                        id={`pay-${method.id}`}
                        type="radio"
                        name="payment-method"
                        value={method.id}
                        checked={paymentMethod === method.id}
                        onChange={() => setPaymentMethod(method.id)}
                        className="mt-1 size-4 accent-[#161616]"
                      />
                      <span className="flex-1">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <method.icon weight="fill" className="size-4" aria-hidden="true" />
                          {method.label}
                        </span>
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {method.hint}
                        </span>
                      </span>
                    </label>
                  ))}
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
                  I understand this is a demo booking at a fictional property, that no payment is
                  taken, and that {ratePlan.cancellationPolicy.toLowerCase()}
                </span>
              </label>
              {!acceptedTerms ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Tick the box above to continue to review.
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 'review' ? (
            <div className="mt-5">
              <dl className="grid gap-4">
              <ReviewRow label="Stay">
                {formatDateRange(criteria.checkIn, criteria.checkOut)} ·{' '}
                {formatNights(quote.price.nights)}
              </ReviewRow>
              <ReviewRow label="Guests">
                {formatGuests(criteria.adults, criteria.children)}
              </ReviewRow>
              <ReviewRow label="Room">
                {room.name}, {ratePlan.name}
              </ReviewRow>
              <ReviewRow label="Services">
                {quote.price.addOnLines.length
                  ? quote.price.addOnLines.map((line) => line.name).join(', ')
                  : 'None'}
              </ReviewRow>
              <ReviewRow label="Guest">
                {guest.firstName} {guest.lastName} · {guest.email} · {guest.phone}
              </ReviewRow>
              <ReviewRow label="Payment">
                {paymentMethods.find((method) => method.id === paymentMethod)?.label} (demo)
              </ReviewRow>
              <ReviewRow label="Total">
                <span className="font-medium">
                  {formatMoney(quote.price.total, quote.price.currency)}
                </span>
              </ReviewRow>
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Price and availability are rechecked on the server the moment you confirm. If either
                changed, we will tell you before anything is created.
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
              <ArrowLeft weight="bold" className="size-4" aria-hidden="true" />
              Back
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
                    <CircleNotch weight="bold" className="size-4 animate-spin" aria-hidden="true" />
                    Confirming…
                  </>
                ) : (
                  <>
                    Confirm demo booking
                    <ArrowRight weight="bold" className="size-4" aria-hidden="true" />
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
                Continue
                <ArrowRight weight="bold" className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </section>
      </div>

      <aside aria-labelledby="booking-summary-heading" className="lg:sticky lg:top-24 lg:h-fit">
        <div className="rounded-[28px] bg-card p-6 shadow-soft">
          <h2 id="booking-summary-heading" className="text-display text-2xl">
            {room.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {hotel.name} · {formatDateRange(criteria.checkIn, criteria.checkOut)}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatGuests(criteria.adults, criteria.children)}
          </p>

          <div
            aria-live="polite"
            aria-busy={repricing}
            className={cn('mt-4 border-t border-border pt-4', repricing && 'opacity-60')}
          >
            <dl className="grid gap-2 text-sm">
              <SummaryRow
                label={`${formatMoney(quote.price.nightlyPrice, quote.price.currency)} × ${formatNights(quote.price.nights)}`}
                value={formatMoney(quote.price.roomTotal, quote.price.currency)}
              />
              {quote.price.addOnLines.map((line) => (
                <SummaryRow
                  key={line.addOnId}
                  label={`${line.name}${line.quantity > 1 ? ` × ${line.quantity}` : ''}`}
                  value={formatMoney(line.total, quote.price.currency)}
                />
              ))}
              <SummaryRow
                label="Taxes and city fees"
                value={formatMoney(quote.price.taxesAndFees, quote.price.currency)}
              />
            </dl>

            <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-border pt-4">
              <span className="text-sm font-medium">Total</span>
              <span className="text-display text-3xl">
                {formatMoney(quote.price.total, quote.price.currency)}
              </span>
            </div>
            {repricing ? (
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <CircleNotch weight="bold" className="size-3.5 animate-spin" aria-hidden="true" />
                Repricing your stay…
              </p>
            ) : null}
          </div>

          <p className="mt-4 rounded-2xl bg-stone/60 p-3 text-xs leading-relaxed text-muted-foreground">
            Demo booking. Payment is simulated, no card data is collected, and the reservation is
            held in memory only.
          </p>
        </div>
      </aside>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
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
