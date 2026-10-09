import { describe, expect, it } from 'vitest';
import { bookingSchema, type PaymentAttempt, type RatePlan } from '../domain/schemas';
import { buildInvoiceDetails, buildInvoiceRegister, invoiceBreakdown } from './accounting-invoices';
import { buildPriceBreakdown } from '../domain/pricing';
import { hotelOrderSchema } from '../domain/orders';

const booking = bookingSchema.parse({ id: 'booking-1', reference: 'ABC123', idempotencyKey: 'invoice-test-key', hotelId: 'hotel-1', roomTypeId: 'room-1', ratePlanId: 'rate-1', checkIn: '2026-10-01', checkOut: '2026-10-02', adults: 2, children: 0, guest: { firstName: 'Ada', lastName: 'Test', email: 'ada@example.com', phone: '555123456' }, addOnIds: [], total: 210, currency: 'EUR', status: 'confirmed', createdAt: '2026-09-29T10:00:00Z' });
const pending: PaymentAttempt = { id: 'payment-1', bookingId: booking.id, provider: 'bank_transfer', status: 'demo_pending', amount: 210, currency: 'EUR' };
const ratePlan: RatePlan = { id: 'rate-1', roomTypeId: 'room-1', name: 'Flexible', nightlyPrice: 200, currency: 'EUR', breakfastIncluded: false, includedServices: [], cancellationPolicy: '' };

describe('demo invoice register', () => {
  it('omits drafts, bookings without attempts and other properties without mutating entries', () => {
    const entries = [
      { booking, payments: [pending] },
      { booking: { ...booking, reference: 'DRAFT1', status: 'draft' as const }, payments: [pending] },
      { booking: { ...booking, reference: 'OTHER1', hotelId: 'hotel-2' }, payments: [pending] },
      { booking: { ...booking, reference: 'EMPTY1' }, payments: [] },
    ];
    expect(buildInvoiceRegister(entries, 'hotel-1').map((row) => row.booking.reference)).toEqual(['ABC123']);
    expect(entries).toHaveLength(4);
  });
  it('includes unpaid, declined and cancelled invoices and sorts newest first', () => {
    const rows = buildInvoiceRegister([
      { booking, payments: [pending] },
      { booking: { ...booking, reference: 'CANCEL', status: 'cancelled', createdAt: '2026-09-30T10:00:00Z' }, payments: [{ ...pending, status: 'authorized' }] },
      { booking: { ...booking, reference: 'FAILED', createdAt: '2026-09-28T10:00:00Z' }, payments: [{ ...pending, status: 'failed' }] },
    ], 'hotel-1');
    expect(rows.map((row) => [row.booking.reference, row.state])).toEqual([['CANCEL', 'owed_back'], ['ABC123', 'awaiting'], ['FAILED', 'declined']]);
    expect(buildInvoiceRegister([], 'hotel-1')).toEqual([]);
  });
});

describe('invoice amounts', () => {
  const confirmation = { booking, room: null, ratePlan, addOns: [], payments: [pending] };
  it('uses matching catalog lines', () => {
    const breakdown = invoiceBreakdown({ ...confirmation, booking: { ...booking, total: 205 } });
    expect(breakdown?.roomTotal).toBe(200);
    expect(breakdown?.taxesAndFees).toBe(5);
    expect(breakdown?.total).toBe(205);
  });
  it('falls back to the booked total when prices, currency or catalog data changed', () => {
    expect(invoiceBreakdown({ ...confirmation, ratePlan: { ...ratePlan, nightlyPrice: 250 } })).toBeNull();
    expect(invoiceBreakdown({ ...confirmation, ratePlan: { ...ratePlan, currency: 'USD' } })).toBeNull();
    expect(invoiceBreakdown({ ...confirmation, ratePlan: null })).toBeNull();
  });
});

describe('detailed invoice', () => {
  it('reconciles room, extras, city tax, completed orders and partial payments/refunds', () => {
    const breakdown = buildPriceBreakdown({ ratePlan, addOns: [], nights: 1, adults: 2, children: 0 });
    const order = hotelOrderSchema.parse({ id: 'service-1', hotelId: booking.hotelId, createdAt: '2026-10-01T12:00:00Z', dueAt: '2026-10-01T12:00:00Z', guestName: 'Ada Test', roomNumber: null, serviceName: 'Dinner', category: 'dining', delivery: 'Hotel pickup', chatCount: 0, total: 30, currency: 'EUR', extras: 0, paymentStatus: 'paid', status: 'completed', bookingReference: booking.reference });
    const result = buildInvoiceDetails({ ...booking, total: 205 }, 'Room', breakdown, [
      pending,
      { ...pending, id: 'paid', amount: 100, status: 'authorized' },
      { ...pending, id: 'refund', amount: 20, status: 'refunded' },
      { ...pending, id: 'failed', amount: 200, status: 'failed' },
    ], [order, { ...order, id: 'cancelled', status: 'cancelled' }, { ...order, id: 'pending-order', status: 'new' }, { ...order, id: 'other', bookingReference: 'OTHER1' }]);
    expect(result.lines.map((line) => [line.type, line.amount])).toEqual([['room', 200], ['tax', 5], ['service', 30]]);
    expect(result.lines[1]).toMatchObject({ quantity: 2, unitPrice: 2.5 });
    expect(result).toMatchObject({ total: 235, paid: 130, refunded: 20, balance: 125 });
    expect(result.payments).toHaveLength(3);
  });
  it('does not invent historical tax or unit prices when catalog amounts differ', () => {
    const changed = buildPriceBreakdown({ ratePlan, addOns: [], nights: 1, adults: 2, children: 0 });
    const result = buildInvoiceDetails(booking, 'Room', changed, []);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toMatchObject({ type: 'booking', quantity: null, unitPrice: null, amount: 210 });
    expect(result.balance).toBe(210);
  });
  it('ignores foreign-currency payment attempts and preserves a credit balance', () => {
    const result = buildInvoiceDetails(booking, 'Room', null, [{ ...pending, currency: 'USD', status: 'authorized' }, { ...pending, amount: 250, status: 'authorized' }]);
    expect(result).toMatchObject({ paid: 250, balance: -40 });
  });
});
