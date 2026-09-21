'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, PlusIcon } from '@heroicons/react/24/outline';
import { recordPaymentAction } from '@/app/admin/accounting/actions';
import type { Currency } from '@/lib/domain/schemas';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { lMoney } from '@/lib/i18n/format';
import { fieldClass, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/site/modal';
import { methodLabel } from '@/components/admin/operations/payment-state';
import { toast } from '@/components/admin/shell/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface UnpaidBooking {
  reference: string;
  guestName: string;
  roomName: string;
  amount: number;
  currency: Currency;
}

/** How the desk actually took the money — a card and a bank transfer share their label with the guest's own checkout (`methodLabel`); POS and cash exist only here. */
const METHODS = ['card', 'pos', 'cash', 'bank_transfer'] as const;

/**
 * The desk's own record of money that moved outside the guest's checkout —
 * a card run through the POS terminal, cash handed over, a transfer that
 * landed. Only bookings the ledger already calls `awaiting` or `declined`
 * are offered, since a settled one has nothing left to add a payment to.
 */
export function AddPaymentButton({ bookings }: { bookings: UnpaidBooking[] }) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reference, setReference] = React.useState('');
  const [method, setMethod] = React.useState<(typeof METHODS)[number]>('card');
  const [amount, setAmount] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const close = React.useCallback(() => setOpen(false), []);

  if (bookings.length === 0) return null;

  const booking = bookings.find((candidate) => candidate.reference === reference) ?? null;

  const openModal = () => {
    setReference(bookings[0]!.reference);
    setMethod('card');
    setAmount(String(bookings[0]!.amount));
    setError('');
    setOpen(true);
  };

  function selectBooking(next: string) {
    setReference(next);
    const found = bookings.find((candidate) => candidate.reference === next);
    if (found) setAmount(String(found.amount));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!booking) return;
    setSubmitting(true);
    setError('');
    const result = await recordPaymentAction(booking.reference, method, Number(amount));
    setSubmitting(false);
    if (result.ok) {
      close();
      toast.success(result.message);
      router.refresh();
    } else {
      setError(result.message);
    }
  }

  return (
    <>
      <button type="button" onClick={openModal} className={pill('primary')}>
        <PlusIcon className="size-4" aria-hidden="true" />
        {t('accounting.addPayment')}
      </button>

      <Modal open={open} onClose={close} title={t('accounting.addPayment')}>
        <form onSubmit={submit} className="grid gap-4">
          <div>
            <label htmlFor="payment-booking" className="mb-1.5 block text-sm text-muted-foreground">
              {t('accounting.selectBooking')}
            </label>
            <Select
              items={bookings.map((candidate) => ({
                value: candidate.reference,
                label: `${candidate.reference} — ${candidate.guestName} — ${lMoney(candidate.amount, candidate.currency, locale)}`,
              }))}
              value={reference}
              onValueChange={(next) => next && selectBooking(next)}
            >
              <SelectTrigger id="payment-booking" className={cn(fieldClass, 'h-11 w-full justify-between gap-2 py-0')}>
                <SelectValue placeholder={t('accounting.selectBookingPlaceholder')} />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border border-border bg-card p-1.5 shadow-soft ring-0">
                {bookings.map((candidate) => (
                  <SelectItem
                    key={candidate.reference}
                    value={candidate.reference}
                    className="rounded-xl py-2 pl-2.5 text-sm data-highlighted:bg-stone data-highlighted:text-foreground"
                  >
                    {candidate.reference} — {candidate.guestName} — {lMoney(candidate.amount, candidate.currency, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {booking ? <p className="mt-1.5 text-xs text-muted-foreground">{booking.roomName}</p> : null}
          </div>

          <div>
            <label className="mb-1.5 block text-sm text-muted-foreground">{t('accounting.thMethod')}</label>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMethod(id)}
                  className={cn(
                    'flex min-h-10 items-center rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors',
                    id === method
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-muted-foreground hover:bg-stone hover:text-foreground',
                  )}
                >
                  {methodLabel(id, locale)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="payment-amount" className="mb-1.5 block text-sm text-muted-foreground">
              {t('accounting.thAmount')}
            </label>
            <input
              id="payment-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={fieldClass}
              required
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={submitting} className={pill('primary')}>
              {submitting ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
              {t('accounting.recordPayment')}
            </button>
            <button type="button" onClick={close} className={pill('secondary')}>
              {t('frontDesk.cancel')}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
