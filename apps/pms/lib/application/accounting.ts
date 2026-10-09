import type { Booking, PaymentAttempt } from '../domain/schemas';

/**
 * Where a booking's money stands, read from its payment attempts:
 * - `collected` — an attempt was authorized and the stay still stands;
 * - `awaiting` — nothing authorized yet (a bank transfer or pay-at-hotel
 *   still settling, or no attempt recorded);
 * - `declined` — the last attempt failed and nothing was authorized;
 * - `owed_back` — the stay was cancelled after money was authorized. A
 *   cancellation leaves payment attempts untouched and there is no refund
 *   model yet, so this is the honest name for it;
 * - `void` — cancelled before anything was paid.
 */
export type LedgerState = 'collected' | 'awaiting' | 'declined' | 'owed_back' | 'void';

export interface LedgerRow {
  booking: Booking;
  /** Provider of the latest attempt, or null when none was recorded. */
  method: string | null;
  /** Receipt and operator for the latest payment event. */
  receipt?: string | null;
  operator?: string | null;
  state: LedgerState;
  /** What this row adds to its state's total; 0 for `void`. */
  amount: number;
}

export interface MethodTotals {
  method: string | null;
  stays: number;
  collected: number;
  awaiting: number;
}

export interface Ledger {
  /** Newest booking first; drafts never reached a payment and are left out. */
  rows: LedgerRow[];
  collected: number;
  /** `awaiting` and `declined` together: stays that still stand and aren't paid. */
  awaiting: number;
  owedBack: number;
  /** The totals of every stay that still stands. */
  bookedValue: number;
  /** `collected` as a share of `bookedValue`, 0–1. */
  settledShare: number;
  counts: Record<LedgerState, number>;
  /** Stays that still stand, by the method they were booked with — largest first. */
  byMethod: MethodTotals[];
}

const cents = (value: number) => Math.round(value * 100) / 100;

export function ledgerState(booking: Booking, payments: PaymentAttempt[]): { state: LedgerState; amount: number } {
  const authorized = payments
    .filter((payment) => payment.status === 'authorized')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const refunded = payments
    .filter((payment) => payment.status === 'refunded')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const net = cents(Math.max(0, authorized - refunded));

  if (booking.status === 'cancelled') {
    return net > 0 ? { state: 'owed_back', amount: net } : { state: 'void', amount: 0 };
  }
  if (net > 0) return { state: 'collected', amount: net };
  if (payments.at(-1)?.status === 'failed') return { state: 'declined', amount: booking.total };
  return { state: 'awaiting', amount: booking.total };
}

/**
 * The accounting screen's figures. Pure, so the rules above live here and not
 * in the page — the page only fetches bookings and their attempts and renders.
 */
export function buildLedger(entries: { booking: Booking; payments: PaymentAttempt[] }[]): Ledger {
  const counts: Record<LedgerState, number> = { collected: 0, awaiting: 0, declined: 0, owed_back: 0, void: 0 };
  const methods = new Map<string, MethodTotals>();
  let collected = 0;
  let awaiting = 0;
  let owedBack = 0;
  let bookedValue = 0;

  const rows = entries
    .filter(({ booking }) => booking.status !== 'draft')
    .sort((a, b) => b.booking.createdAt.localeCompare(a.booking.createdAt))
    .map(({ booking, payments }): LedgerRow => {
      const { state, amount } = ledgerState(booking, payments);
      const latest = payments.at(-1);
      const method = latest?.provider ?? null;
      const receipt = latest?.receiptNumber
        ?? (latest ? `DEMO-${booking.createdAt.slice(0, 10).replaceAll('-', '')}-${booking.reference}` : null);
      const operator = latest?.operatorName
        ?? (latest ? (latest.id.startsWith('pay_') ? 'Guest checkout' : 'System') : null);
      counts[state] += 1;

      if (state === 'collected') collected += amount;
      if (state === 'awaiting' || state === 'declined') awaiting += amount;
      if (state === 'owed_back') owedBack += amount;

      if (booking.status !== 'cancelled') {
        bookedValue += booking.total;
        const key = method ?? '';
        const totals = methods.get(key) ?? { method, stays: 0, collected: 0, awaiting: 0 };
        totals.stays += 1;
        if (state === 'collected') totals.collected += amount;
        else totals.awaiting += amount;
        methods.set(key, totals);
      }

      return { booking, method, receipt, operator, state, amount };
    });

  const byMethod = [...methods.values()]
    .map((totals) => ({ ...totals, collected: cents(totals.collected), awaiting: cents(totals.awaiting) }))
    .sort((a, b) => b.collected + b.awaiting - (a.collected + a.awaiting));

  const booked = cents(bookedValue);
  const collectedTotal = cents(collected);

  return {
    rows,
    collected: collectedTotal,
    awaiting: cents(awaiting),
    owedBack: cents(owedBack),
    bookedValue: booked,
    settledShare: booked > 0 ? collectedTotal / booked : 0,
    counts,
    byMethod,
  };
}
