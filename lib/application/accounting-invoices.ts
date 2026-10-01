import { buildPriceBreakdown, nightsBetween } from '../domain/pricing';
import type { Booking, PaymentAttempt } from '../domain/schemas';
import type { BookingConfirmation } from './booking-service';
import { ledgerState } from './accounting';

/** The existing demo invoice rule: one invoice per non-draft booking with a payment attempt.
 * These are derived previews, not a persisted/fiscal invoice registry. Cancelled stays remain visible. */
export function buildInvoiceRegister(entries: { booking: Booking; payments: PaymentAttempt[] }[], hotelId: string) {
  return entries
    .filter(({ booking, payments }) => booking.hotelId === hotelId && booking.status !== 'draft' && payments.length > 0)
    .map(({ booking, payments }) => ({ booking, state: ledgerState(booking, payments).state }))
    .sort((a, b) => b.booking.createdAt.localeCompare(a.booking.createdAt) || a.booking.reference.localeCompare(b.booking.reference));
}

/** Never print today's catalog prices against a historical booking total.
 * Without stored line-item snapshots, a changed catalog falls back to the booked amount. */
export function invoiceBreakdown({ booking, ratePlan, addOns }: BookingConfirmation) {
  if (!ratePlan || ratePlan.currency !== booking.currency) return null;
  const breakdown = buildPriceBreakdown({ ratePlan, addOns, nights: nightsBetween(booking.checkIn, booking.checkOut), adults: booking.adults, children: booking.children });
  return Math.abs(breakdown.total - booking.total) < 0.005 ? breakdown : null;
}
