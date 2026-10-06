import { describe, expect, it } from 'vitest';
import type { Booking, BookingGroup } from '@/lib/domain/schemas';
import { attachableBookings, bookingsForGroup, searchGroups, summarizeGroup } from './group-directory';

function booking(overrides: Partial<Booking> & { id: string }): Booking {
  return {
    reference: overrides.id.toUpperCase(),
    idempotencyKey: `key-${overrides.id}`,
    hotelId: 'asteria-cove',
    roomTypeId: 'room_sea_view',
    ratePlanId: 'rate_flex',
    checkIn: '2026-10-01',
    checkOut: '2026-10-04',
    adults: 2,
    children: 0,
    guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+1 555 0100' },
    addOnIds: [],
    total: 900,
    currency: 'USD',
    status: 'confirmed',
    stayState: 'booked',
    createdAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

const group: BookingGroup = { id: 'g1', hotelId: 'asteria-cove', name: 'Smith wedding', createdAt: '2026-09-01T09:00:00.000Z' };

describe('summarizeGroup', () => {
  it('sums non-cancelled member totals and counts cancellations', () => {
    const bookings = [
      booking({ id: 'a1', groupId: 'g1', total: 900, createdAt: '2026-09-01T10:00:00.000Z' }),
      booking({ id: 'a2', groupId: 'g1', total: 500, status: 'cancelled', createdAt: '2026-09-02T10:00:00.000Z' }),
      booking({ id: 'a3', groupId: 'g2', total: 300, createdAt: '2026-09-03T10:00:00.000Z' }),
    ];
    const summary = summarizeGroup(group, bookings);
    expect(summary.bookingsCount).toBe(2);
    expect(summary.cancelledCount).toBe(1);
    expect(summary.amount).toBe(900);
    expect(summary.bookings.map((b) => b.id)).toEqual(['a2', 'a1']);
  });
});

describe('bookingsForGroup', () => {
  it('returns only that group\'s bookings, newest first', () => {
    const bookings = [
      booking({ id: 'a1', groupId: 'g1', createdAt: '2026-09-01T10:00:00.000Z' }),
      booking({ id: 'a2', groupId: 'g1', createdAt: '2026-09-10T10:00:00.000Z' }),
      booking({ id: 'b1', groupId: 'g2', createdAt: '2026-09-05T10:00:00.000Z' }),
    ];
    expect(bookingsForGroup(bookings, 'g1').map((b) => b.id)).toEqual(['a2', 'a1']);
  });
});

describe('attachableBookings', () => {
  it('excludes cancelled bookings, other hotels, and bookings already in a different group', () => {
    const bookings = [
      booking({ id: 'a1' }),
      booking({ id: 'a2', status: 'cancelled' }),
      booking({ id: 'a3', hotelId: 'other-hotel' }),
      booking({ id: 'a4', groupId: 'g2' }),
      booking({ id: 'a5', groupId: 'g1' }),
    ];
    expect(attachableBookings(bookings, 'asteria-cove', 'g1').map((b) => b.id).sort()).toEqual(['a1', 'a5']);
  });
});

describe('searchGroups', () => {
  it('matches by name or notes, case-insensitively', () => {
    const groups: BookingGroup[] = [
      { id: 'g1', hotelId: 'asteria-cove', name: 'Smith wedding', createdAt: '2026-09-01T09:00:00.000Z' },
      { id: 'g2', hotelId: 'asteria-cove', name: 'Acme conference', notes: 'Rooms for the sales team', createdAt: '2026-09-02T09:00:00.000Z' },
    ];
    expect(searchGroups(groups, 'wedding').map((g) => g.id)).toEqual(['g1']);
    expect(searchGroups(groups, 'SALES TEAM').map((g) => g.id)).toEqual(['g2']);
    expect(searchGroups(groups, '')).toHaveLength(2);
  });
});
