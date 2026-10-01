import { describe, expect, it } from 'vitest';
import { bookingSchema, type PaymentAttempt, type RatePlan } from '../domain/schemas';
import { buildInvoiceRegister, invoiceBreakdown } from './accounting-invoices';

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
