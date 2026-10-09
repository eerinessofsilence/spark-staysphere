import { buildPriceBreakdown, nightsBetween, roundMoney } from '../domain/pricing';
import type { Booking, PaymentAttempt, PriceBreakdown } from '../domain/schemas';
import type { HotelOrder } from '../domain/orders';
import type { BookingConfirmation } from './booking-service';
import { ledgerState } from './accounting';

export interface InvoiceRegisterRow {
  booking: Booking;
  state: ReturnType<typeof ledgerState>['state'];
  method: string;
}

/** The existing demo invoice rule: one invoice per non-draft booking with a payment attempt.
 * These are derived previews, not a persisted/fiscal invoice registry. Cancelled stays remain visible. */
export function buildInvoiceRegister(entries: { booking: Booking; payments: PaymentAttempt[] }[], hotelId: string) {
  return entries
    .filter(({ booking, payments }) => booking.hotelId === hotelId && booking.status !== 'draft' && payments.length > 0)
    .map(({ booking, payments }): InvoiceRegisterRow => ({ booking, state: ledgerState(booking, payments).state, method: payments.at(-1)!.provider }))
    .sort((a, b) => b.booking.createdAt.localeCompare(a.booking.createdAt) || a.booking.reference.localeCompare(b.booking.reference));
}

/** Never print today's catalog prices against a historical booking total.
 * Without stored line-item snapshots, a changed catalog falls back to the booked amount. */
export function invoiceBreakdown({ booking, ratePlan, addOns }: BookingConfirmation) {
  if (!ratePlan || ratePlan.currency !== booking.currency) return null;
  const breakdown = buildPriceBreakdown({ ratePlan, checkIn: booking.checkIn, addOns, nights: nightsBetween(booking.checkIn, booking.checkOut), adults: booking.adults, children: booking.children });
  return Math.abs(breakdown.total - booking.total) < 0.005 ? breakdown : null;
}

export interface InvoiceDetails {
  phone: string;
  roomNumber: string | null;
  lines: { id: string; type: 'room' | 'service' | 'tax' | 'booking'; description: string; date: string; endDate?: string; quantity: number | null; unitPrice: number | null; amount: number }[];
  payments: { id: string; date: string | null; method: string; type: 'payment' | 'refund'; amount: number; receipt?: string; operator?: string }[];
  total: number;
  paid: number;
  refunded: number;
  balance: number;
}

/** Show only reconciled booking prices and completed linked service orders.
 * Pending/failed payment attempts never reduce the amount due. Unknown VAT,
 * partial-order payments and historical unit prices are never fabricated. */
export function buildInvoiceDetails(booking: Booking, roomName: string, breakdown: PriceBreakdown | null, payments: PaymentAttempt[], orders: HotelOrder[] = []): InvoiceDetails {
  const exact = breakdown && breakdown.currency === booking.currency && Math.abs(breakdown.total - booking.total) < 0.005 ? breakdown : null;
  const lines: InvoiceDetails['lines'] = exact ? [
    { id: 'room', type: 'room', description: roomName, date: booking.checkIn, endDate: booking.checkOut, quantity: exact.nightlyPrices ? null : exact.nights, unitPrice: exact.nightlyPrices ? null : exact.nightlyPrice, amount: exact.roomTotal },
    ...exact.addOnLines.map((line) => ({ id: `addon:${line.addOnId}`, type: 'service' as const, description: line.name, date: booking.checkIn, quantity: line.quantity, unitPrice: line.unitPrice, amount: line.total })),
    { id: 'city-tax', type: 'tax', description: '', date: booking.checkIn, endDate: booking.checkOut, quantity: booking.adults * exact.nights, unitPrice: booking.adults * exact.nights > 0 ? roundMoney(exact.taxesAndFees / (booking.adults * exact.nights)) : 0, amount: exact.taxesAndFees },
  ] : [{ id: 'booking', type: 'booking', description: roomName, date: booking.checkIn, endDate: booking.checkOut, quantity: null, unitPrice: null, amount: booking.total }];
  const linked = orders.filter((order) => order.hotelId === booking.hotelId && order.bookingReference === booking.reference && order.status === 'completed' && order.currency === booking.currency);
  lines.push(...linked.map((order) => ({ id: `order:${order.id}`, type: 'service' as const, description: order.serviceName, date: order.dueAt.slice(0, 10), quantity: 1, unitPrice: order.total, amount: order.total })));
  const events: InvoiceDetails['payments'] = payments.filter((payment) => payment.currency === booking.currency && (payment.status === 'authorized' || payment.status === 'refunded')).map((payment) => ({
    id: payment.id, date: payment.createdAt?.slice(0, 10) ?? null, method: payment.provider, type: payment.status === 'refunded' ? 'refund' : 'payment', amount: payment.amount, receipt: payment.receiptNumber, operator: payment.operatorName,
  }));
  // Paid operational orders have a known settled amount but no method/date receipt.
  events.push(...linked.filter((order) => order.paymentStatus === 'paid').map((order) => ({ id: `order:${order.id}`, date: null, method: '', type: 'payment' as const, amount: order.total })));
  const paid = roundMoney(events.filter((payment) => payment.type === 'payment').reduce((sum, payment) => sum + payment.amount, 0));
  const refunded = roundMoney(events.filter((payment) => payment.type === 'refund').reduce((sum, payment) => sum + payment.amount, 0));
  const total = roundMoney(lines.reduce((sum, line) => sum + line.amount, 0));
  return { phone: booking.guest.phone, roomNumber: booking.unitNumber ?? null, lines, payments: events, total, paid, refunded, balance: roundMoney(total - paid + refunded) };
}
