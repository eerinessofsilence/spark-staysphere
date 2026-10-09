import { describe, expect, it } from 'vitest';
import type { Booking, GuestProfile } from '@/lib/domain/schemas';
import { bookingsForGuest, buildGuestDirectory, searchGuestDirectory } from './guest-directory';

function profile(overrides: Partial<GuestProfile> & { id: string }): GuestProfile {
  return {
    hotelId: 'asteria-cove',
    firstName: 'Nadia',
    lastName: 'Petrova',
    email: 'nadia@example.com',
    phone: '+1 555 0200',
    createdAt: '2026-09-01T09:00:00.000Z',
    ...overrides,
  };
}

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

describe('buildGuestDirectory', () => {
  it('groups bookings by email, case- and whitespace-insensitively', () => {
    const bookings = [
      booking({ id: 'a1', guest: { firstName: 'Ada', lastName: 'Lovelace', email: ' Ada@Example.com ', phone: '+1 555 0100' } }),
      booking({ id: 'a2', guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+1 555 0100' } }),
    ];
    const directory = buildGuestDirectory(bookings);
    expect(directory).toHaveLength(1);
    expect(directory[0].bookingsCount).toBe(2);
  });

  it('sums total and nights across non-cancelled bookings only', () => {
    const bookings = [
      booking({ id: 'a1', total: 900, checkIn: '2026-10-01', checkOut: '2026-10-04', createdAt: '2026-09-01T10:00:00.000Z' }),
      booking({ id: 'a2', total: 500, checkIn: '2026-11-01', checkOut: '2026-11-02', status: 'cancelled', createdAt: '2026-09-05T10:00:00.000Z' }),
    ];
    const [guest] = buildGuestDirectory(bookings);
    expect(guest.totalSpent).toBe(900);
    expect(guest.nights).toBe(3);
    expect(guest.bookingsCount).toBe(2);
    expect(guest.cancelledCount).toBe(1);
  });

  it('takes name and phone from the most recently created booking', () => {
    const bookings = [
      booking({ id: 'a1', guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+1 555 0100' }, createdAt: '2026-09-01T10:00:00.000Z' }),
      booking({ id: 'a2', guest: { firstName: 'Ada', lastName: 'King', email: 'ada@example.com', phone: '+1 555 9999' }, createdAt: '2026-09-10T10:00:00.000Z' }),
    ];
    const [guest] = buildGuestDirectory(bookings);
    expect(guest.lastName).toBe('King');
    expect(guest.phone).toBe('+1 555 9999');
  });

  it('sorts by most recent booking first', () => {
    const bookings = [
      booking({ id: 'a1', guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+1' }, createdAt: '2026-09-01T10:00:00.000Z' }),
      booking({ id: 'b1', guest: { firstName: 'Bea', lastName: 'Smith', email: 'bea@example.com', phone: '+2' }, createdAt: '2026-09-20T10:00:00.000Z' }),
    ];
    const directory = buildGuestDirectory(bookings);
    expect(directory.map((guest) => guest.id)).toEqual(['bea@example.com', 'ada@example.com']);
  });
});

describe('buildGuestDirectory with guest profiles', () => {
  it('adds a zero-booking row for a profile with no matching booking', () => {
    const directory = buildGuestDirectory(
      [booking({ id: 'a1' })],
      [profile({ id: 'p1' })],
      'EUR',
    );
    expect(directory).toHaveLength(2);
    const nadia = directory.find((guest) => guest.id === 'nadia@example.com')!;
    expect(nadia.bookingsCount).toBe(0);
    expect(nadia.totalSpent).toBe(0);
    expect(nadia.currency).toBe('EUR');
    expect(nadia.lastCheckIn).toBeNull();
  });

  it('lets a booking made under the same email absorb the profile, not duplicate it', () => {
    const directory = buildGuestDirectory(
      [booking({ id: 'a1', guest: { firstName: 'Nadia', lastName: 'Petrova', email: 'nadia@example.com', phone: '+1 555 0200' } })],
      [profile({ id: 'p1' })],
    );
    expect(directory).toHaveLength(1);
    expect(directory[0].bookingsCount).toBe(1);
  });
});

describe('bookingsForGuest', () => {
  it('returns only that guest\'s bookings, newest first', () => {
    const bookings = [
      booking({ id: 'a1', guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+1' }, createdAt: '2026-09-01T10:00:00.000Z' }),
      booking({ id: 'a2', guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+1' }, createdAt: '2026-09-10T10:00:00.000Z' }),
      booking({ id: 'b1', guest: { firstName: 'Bea', lastName: 'Smith', email: 'bea@example.com', phone: '+2' }, createdAt: '2026-09-05T10:00:00.000Z' }),
    ];
    expect(bookingsForGuest(bookings, 'ada@example.com').map((b) => b.id)).toEqual(['a2', 'a1']);
  });
});

describe('searchGuestDirectory', () => {
  it('matches by name, email or phone, case-insensitively', () => {
    const directory = buildGuestDirectory([
      booking({ id: 'a1', guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '+1 555 0100' } }),
      booking({ id: 'b1', guest: { firstName: 'Bea', lastName: 'Smith', email: 'bea@example.com', phone: '+2 555 0200' } }),
    ]);
    expect(searchGuestDirectory(directory, 'lovelace').map((g) => g.id)).toEqual(['ada@example.com']);
    expect(searchGuestDirectory(directory, 'BEA@EXAMPLE').map((g) => g.id)).toEqual(['bea@example.com']);
    expect(searchGuestDirectory(directory, '0200').map((g) => g.id)).toEqual(['bea@example.com']);
    expect(searchGuestDirectory(directory, '')).toHaveLength(2);
  });
});
