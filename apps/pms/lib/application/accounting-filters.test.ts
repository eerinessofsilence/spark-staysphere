import { describe, expect, it } from 'vitest';
import { bookingSchema } from '../domain/schemas';
import { buildLedger, type LedgerState } from './accounting';
import { filterPaymentRows, parsePaymentFilters, PAYMENT_STATES, resetPaymentFiltersHref } from './accounting-filters';

const booking = bookingSchema.parse({ id: 'booking-1', reference: 'ABC123', idempotencyKey: 'filter-test-key', hotelId: 'hotel-1', roomTypeId: 'room-1', ratePlanId: 'rate-1', checkIn: '2026-10-01', checkOut: '2026-10-02', adults: 2, children: 0, guest: { firstName: 'Ada', lastName: 'Test', email: 'ada@example.com', phone: '555123456' }, addOnIds: [], total: 210, currency: 'EUR', status: 'confirmed', createdAt: '2026-09-29T10:00:00Z' });
const rows = PAYMENT_STATES.map((state, index) => ({ booking: { ...booking, reference: `ABC12${index}`, createdAt: `2026-09-${30 - index}T23:59:59Z` }, state, method: index === 0 ? null : index % 2 ? 'card' : 'bank_transfer', amount: 210 }));

describe('payment register filters', () => {
  it('defaults to all payments and preserves newest-first order without changing rows', () => {
    expect(filterPaymentRows(rows, parsePaymentFilters({}))).toEqual(rows);
    expect(rows).toHaveLength(5);
  });
  it.each(PAYMENT_STATES)('filters the payment state %s', (status: LedgerState) => {
    expect(filterPaymentRows(rows, parsePaymentFilters({ status })).map((row) => row.state)).toEqual([status]);
  });
  it.each(['abc120', 'ADA TEST', 'ada@example.com'])('finds a reference, guest or email without case sensitivity: %s', (q) => {
    const found = filterPaymentRows(rows, parsePaymentFilters({ q: ` ${q} ` }));
    expect(found.length).toBe(q === 'abc120' ? 1 : 5);
  });
  it('combines filters before pagination', () => {
    expect(filterPaymentRows(rows, parsePaymentFilters({ q: 'Ada', status: 'awaiting', method: 'card', from: '2026-09-29', to: '2026-09-29' })).map((row) => row.booking.reference)).toEqual(['ABC121']);
    expect(filterPaymentRows(rows, parsePaymentFilters({ status: 'awaiting', method: 'bank_transfer' }))).toEqual([]);
  });
  it('uses inclusive Booked dates rather than the stay, and supports open ends', () => {
    expect(filterPaymentRows(rows, parsePaymentFilters({ from: '2026-09-28', to: '2026-09-29' })).map((row) => row.booking.reference)).toEqual(['ABC121', 'ABC122']);
    expect(filterPaymentRows(rows, parsePaymentFilters({ from: '2026-09-29' }))).toHaveLength(2);
    expect(filterPaymentRows(rows, parsePaymentFilters({ to: '2026-09-27' }))).toHaveLength(2);
    expect(filterPaymentRows(rows, parsePaymentFilters({ from: '2026-10-01' }))).toEqual([]);
  });
  it('matches a recorded method, missing attempts, and rejects an unknown method', () => {
    expect(filterPaymentRows(rows, parsePaymentFilters({ method: 'card' }))).toHaveLength(2);
    expect(filterPaymentRows(rows, parsePaymentFilters({ method: 'none' }))).toHaveLength(1);
    expect(filterPaymentRows(rows, parsePaymentFilters({ method: 'not-a-provider' }))).toEqual([]);
  });
  it.each([{ from: '2026-02-30' }, { to: 'garbage' }, { from: '2026-9-29' }, { from: '2026-09-30', to: '2026-09-29' }])('invalid or reversed dates cannot silently show all rows: %s', (params) => {
    const filters = parsePaymentFilters(params);
    expect(filters.invalidDates).toBe(true);
    expect(filterPaymentRows(rows, filters)).toEqual([]);
  });
  it('accepts leap days, normalizes repeated URL keys and ignores unknown status', () => {
    expect(parsePaymentFilters({ from: '2028-02-29', q: ['Ada', 'Other'], status: 'not-a-status' })).toMatchObject({ from: '2028-02-29', query: 'Ada', status: null, invalidDates: false });
    expect(parsePaymentFilters({ q: 'a'.repeat(300) }).query).toHaveLength(200);
  });
  it('reset preserves unrelated pagers and page size but resets the filtered page', () => {
    expect(resetPaymentFiltersHref({ page: '5', q: 'Ada', status: 'collected', method: 'card', from: '2026-09-01', to: '2026-09-30', pageSize: '10', methodPage: '2', methodPageSize: '50' })).toBe('/admin/accounting?pageSize=10&methodPage=2&methodPageSize=50');
    expect(resetPaymentFiltersHref({})).toBe('/admin/accounting');
  });
  it('does not alter global accounting totals or omit unpaid bookings from Add payment', () => {
    const ledger = buildLedger([{ booking, payments: [] }]);
    expect(filterPaymentRows(ledger.rows, parsePaymentFilters({ status: 'collected' }))).toEqual([]);
    expect(ledger.awaiting).toBe(210);
    expect(ledger.rows[0].state).toBe('awaiting');
  });
  it('subtracts partial refunds and clears the amount owed back after a full refund', () => {
    const authorized = { id: 'pay-1', bookingId: booking.id, provider: 'card', status: 'authorized' as const, amount: 210, currency: 'EUR' as const };
    const partial = { id: 'refund-1', bookingId: booking.id, provider: 'cash', status: 'refunded' as const, amount: 60, currency: 'EUR' as const };
    expect(buildLedger([{ booking, payments: [authorized, partial] }]).rows[0]).toMatchObject({ state: 'collected', amount: 150 });
    const cancelled = { ...booking, status: 'cancelled' as const };
    expect(buildLedger([{ booking: cancelled, payments: [authorized, partial] }]).rows[0]).toMatchObject({ state: 'owed_back', amount: 150 });
    const full = { ...partial, id: 'refund-2', amount: 150 };
    expect(buildLedger([{ booking: cancelled, payments: [authorized, partial, full] }]).rows[0]).toMatchObject({ state: 'void', amount: 0 });
  });
});
