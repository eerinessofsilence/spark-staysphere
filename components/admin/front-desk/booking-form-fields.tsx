'use client';

import type { FrontDeskQuoteResult } from '@/app/admin/front-desk/actions';
import { AUTHORIZING_METHODS } from '@/lib/application/booking-service';
import type { PaymentMethod } from '@/lib/domain/schemas';
import type { AdminLocale } from '@/lib/i18n/admin/locale';
import type { AdminT } from '@/lib/i18n/admin/translate';
import { lMoney } from '@/lib/i18n/format';
import { fieldClass } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { methodLabel } from '@/components/admin/operations/payment-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * The half of the create-booking form that never changes between the two
 * places it appears — a drag on a specific room's row (`FrontDeskGrid`'s
 * `CreateBookingForm`) and the toolbar's own "Add booking"
 * (`AddBookingButton`'s `NewBookingForm`), which only differ in how the room
 * and dates are chosen. Kept in one place so the fields, their order, and
 * their validation read the same regardless of which door the admin came in.
 */

export function BookingField({
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
      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface GuestParty {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  adults: number;
  children: number;
}

export const emptyGuestParty: GuestParty = { firstName: '', lastName: '', email: '', phone: '', adults: 2, children: 0 };

export function GuestPartyFields({
  value,
  onChange,
  t,
  fieldErrors,
}: {
  value: GuestParty;
  onChange: (patch: Partial<GuestParty>) => void;
  t: AdminT;
  fieldErrors: Record<string, string[]>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <BookingField id="fd-first-name" label={t('account.firstName')} error={fieldErrors.firstName?.[0]}>
        <input
          id="fd-first-name"
          value={value.firstName}
          onChange={(event) => onChange({ firstName: event.target.value })}
          placeholder={t('frontDesk.firstNamePlaceholder')}
          required
          autoComplete="given-name"
          className={fieldClass}
        />
      </BookingField>
      <BookingField id="fd-last-name" label={t('account.lastName')} error={fieldErrors.lastName?.[0]}>
        <input
          id="fd-last-name"
          value={value.lastName}
          onChange={(event) => onChange({ lastName: event.target.value })}
          placeholder={t('frontDesk.lastNamePlaceholder')}
          required
          autoComplete="family-name"
          className={fieldClass}
        />
      </BookingField>
      <BookingField id="fd-email" label={t('account.email')} error={fieldErrors.email?.[0]}>
        <input
          id="fd-email"
          type="email"
          value={value.email}
          onChange={(event) => onChange({ email: event.target.value })}
          placeholder={t('frontDesk.emailPlaceholder')}
          required
          autoComplete="email"
          className={fieldClass}
        />
      </BookingField>
      <BookingField id="fd-phone" label={t('account.phone')} error={fieldErrors.phone?.[0]}>
        <input
          id="fd-phone"
          type="tel"
          value={value.phone}
          onChange={(event) => onChange({ phone: event.target.value })}
          placeholder={t('frontDesk.phonePlaceholder')}
          required
          autoComplete="tel"
          className={fieldClass}
        />
      </BookingField>
      <BookingField id="fd-adults" label={t('frontDesk.adults')}>
        <input
          id="fd-adults"
          type="number"
          min={1}
          max={8}
          value={value.adults}
          onChange={(event) => onChange({ adults: Math.max(1, Math.min(8, Number(event.target.value) || 1)) })}
          className={fieldClass}
        />
      </BookingField>
      <BookingField id="fd-children" label={t('frontDesk.children')}>
        <input
          id="fd-children"
          type="number"
          min={0}
          max={6}
          value={value.children}
          onChange={(event) => onChange({ children: Math.max(0, Math.min(6, Number(event.target.value) || 0)) })}
          className={fieldClass}
        />
      </BookingField>
    </div>
  );
}

const PAYMENT_METHODS: PaymentMethod[] = ['pay_at_hotel', 'card', 'apple_pay', 'google_pay', 'bank_transfer'];

/**
 * What the desk is booking this stay as — the same lever a guest's own
 * payment-method step pulls, and the one thing that decides whether the
 * booking is created paid or awaiting payment (`AUTHORIZING_METHODS` in
 * `booking-service.ts`). Defaults to "pay at hotel", the desk's own most
 * common case (no card taken over the phone) — see `actions.ts`'s doc
 * comment.
 */
export function PaymentMethodField({
  value,
  onChange,
  t,
  locale,
}: {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
  t: AdminT;
  locale: AdminLocale;
}) {
  return (
    <div>
      <label htmlFor="fd-payment-method" className="mb-1.5 block text-sm text-muted-foreground">
        {t('frontDesk.paymentMethod')}
      </label>
      <Select
        items={PAYMENT_METHODS.map((method) => ({ value: method, label: methodLabel(method, locale) }))}
        value={value}
        onValueChange={(next) => next && onChange(next as PaymentMethod)}
      >
        <SelectTrigger id="fd-payment-method" className={cn(fieldClass, 'h-11 w-full justify-between gap-2 py-0')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-2xl border border-border bg-card p-1.5 shadow-soft ring-0">
          {PAYMENT_METHODS.map((method) => (
            <SelectItem key={method} value={method} className="rounded-xl py-2 pl-2.5 text-sm data-highlighted:bg-stone data-highlighted:text-foreground">
              {methodLabel(method, locale)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="mt-1.5 text-xs text-muted-foreground">{t('frontDesk.paymentMethodHint')}</p>
    </div>
  );
}

/** The quoted total, or why there isn't one yet — with a note on when the chosen method takes the money. */
export function PriceFooter({
  t,
  locale,
  quoting,
  quote,
  paymentMethod,
}: {
  t: AdminT;
  locale: AdminLocale;
  quoting: boolean;
  quote: FrontDeskQuoteResult | null;
  paymentMethod: PaymentMethod;
}) {
  return (
    <>
      <div className="mt-5 flex items-baseline justify-between border-t border-border pt-4">
        <span className="text-sm text-muted-foreground">{t('frontDesk.total')}</span>
        <span className="text-display text-2xl tabular-nums">
          {quoting ? t('frontDesk.priceCalculating') : quote?.ok ? lMoney(quote.total, quote.currency, locale) : (quote?.message ?? '')}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {t(AUTHORIZING_METHODS.has(paymentMethod) ? 'frontDesk.paidNowNote' : 'frontDesk.payAtHotelNote')}
      </p>
    </>
  );
}
