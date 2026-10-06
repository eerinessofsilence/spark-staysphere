import { nightsBetween } from '@/lib/domain/pricing';
import type { Booking, Currency, GuestProfile } from '@/lib/domain/schemas';

/**
 * A guest's own booking history is derived by grouping bookings on their
 * email (see `buildGuestDirectory` below) — the same rule the booking
 * detail page's history block already applies to one guest, run over every
 * guest at once. A guest created directly on `/admin/guests`, before any
 * booking exists, is a `GuestProfile` (`lib/domain/schemas.ts`) instead;
 * `buildGuestDirectory` merges the two by email so a booking made later
 * under the same address is just more history for the same row, not a
 * second guest.
 */
export interface GuestSummary {
  /** The guest's email, lower-cased and trimmed — stable across every booking they've made, and the id this directory is keyed and routed by. */
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bookingsCount: number;
  cancelledCount: number;
  /** Sum of every non-cancelled booking's total, in the hotel's own currency — bookings never mix currencies within one hotel. */
  totalSpent: number;
  currency: Currency;
  nights: number;
  firstBookingAt: string;
  lastBookingAt: string;
  /** The latest check-in across every booking, cancelled or not — `null` for a guest on file who has never actually stayed. */
  lastCheckIn: string | null;
}

function newestWins<T>(current: T, candidateCreatedAt: string, currentCreatedAt: string, candidate: T): T {
  return candidateCreatedAt > currentCreatedAt ? candidate : current;
}

/**
 * Groups every booking by its guest's email into one row per guest, newest
 * booking's name/phone winning when a guest's details changed between
 * stays, then adds a zero-booking row for every guest profile
 * (`GuestProfile`) whose email isn't already covered by a booking — a
 * guest on file who hasn't stayed yet. `hotelCurrency` only ever labels
 * those all-zero rows; a guest with a real booking always shows its own.
 */
export function buildGuestDirectory(bookings: Booking[], profiles: GuestProfile[] = [], hotelCurrency: Currency = 'USD'): GuestSummary[] {
  const byEmail = new Map<string, GuestSummary & { _newestCreatedAt: string }>();

  for (const booking of bookings) {
    const id = booking.guest.email.trim().toLowerCase();
    const nights = nightsBetween(booking.checkIn, booking.checkOut);
    const existing = byEmail.get(id);

    if (!existing) {
      byEmail.set(id, {
        id,
        firstName: booking.guest.firstName,
        lastName: booking.guest.lastName,
        email: booking.guest.email,
        phone: booking.guest.phone,
        bookingsCount: 1,
        cancelledCount: booking.status === 'cancelled' ? 1 : 0,
        totalSpent: booking.status === 'cancelled' ? 0 : booking.total,
        currency: booking.currency,
        nights: booking.status === 'cancelled' ? 0 : nights,
        firstBookingAt: booking.createdAt,
        lastBookingAt: booking.createdAt,
        lastCheckIn: booking.checkIn,
        _newestCreatedAt: booking.createdAt,
      });
      continue;
    }

    existing.bookingsCount += 1;
    if (booking.status === 'cancelled') {
      existing.cancelledCount += 1;
    } else {
      existing.totalSpent += booking.total;
      existing.nights += nights;
    }
    existing.firstBookingAt = existing.firstBookingAt < booking.createdAt ? existing.firstBookingAt : booking.createdAt;
    existing.lastBookingAt = existing.lastBookingAt > booking.createdAt ? existing.lastBookingAt : booking.createdAt;
    existing.lastCheckIn = existing.lastCheckIn && existing.lastCheckIn > booking.checkIn ? existing.lastCheckIn : booking.checkIn;
    existing.firstName = newestWins(existing.firstName, booking.createdAt, existing._newestCreatedAt, booking.guest.firstName);
    existing.lastName = newestWins(existing.lastName, booking.createdAt, existing._newestCreatedAt, booking.guest.lastName);
    existing.phone = newestWins(existing.phone, booking.createdAt, existing._newestCreatedAt, booking.guest.phone);
    existing._newestCreatedAt = existing._newestCreatedAt > booking.createdAt ? existing._newestCreatedAt : booking.createdAt;
  }

  for (const profile of profiles) {
    const id = profile.email.trim().toLowerCase();
    if (byEmail.has(id)) continue; // A booking already covers this guest — more history, not a second row.
    byEmail.set(id, {
      id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phone,
      bookingsCount: 0,
      cancelledCount: 0,
      totalSpent: 0,
      currency: hotelCurrency,
      nights: 0,
      firstBookingAt: profile.createdAt,
      lastBookingAt: profile.createdAt,
      lastCheckIn: null,
      _newestCreatedAt: profile.createdAt,
    });
  }

  return [...byEmail.values()]
    .map(({ _newestCreatedAt, ...summary }) => summary)
    .sort((a, b) => b.lastBookingAt.localeCompare(a.lastBookingAt));
}

/** A guest's own bookings, newest first — the same rule `/admin/bookings/[reference]`'s history block already applies to one guest. */
export function bookingsForGuest(bookings: Booking[], guestId: string): Booking[] {
  return bookings
    .filter((booking) => booking.guest.email.trim().toLowerCase() === guestId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function matchesQuery(guest: GuestSummary, query: string): boolean {
  const needle = query.toLowerCase();
  return [`${guest.firstName} ${guest.lastName}`, guest.email, guest.phone].some((value) => value.toLowerCase().includes(needle));
}

export function searchGuestDirectory(guests: GuestSummary[], query: string): GuestSummary[] {
  const trimmed = query.trim();
  return trimmed ? guests.filter((guest) => matchesQuery(guest, trimmed)) : guests;
}
