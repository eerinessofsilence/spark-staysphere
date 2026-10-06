import type { Booking, BookingGroup } from '@/lib/domain/schemas';

/**
 * A group is only a label and a set of bookings tagged with its id
 * (`bookingSchema.groupId`) — everything else about it (its bookings, its
 * balance) is derived by filtering, the same "derive from bookings" rule
 * `lib/application/guest-directory.ts` already applies to a guest.
 */
export interface GroupSummary {
  group: BookingGroup;
  bookings: Booking[];
  bookingsCount: number;
  cancelledCount: number;
  /** Sum of every non-cancelled member booking's total. */
  amount: number;
}

export function bookingsForGroup(bookings: Booking[], groupId: string): Booking[] {
  return bookings.filter((booking) => booking.groupId === groupId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function summarizeGroup(group: BookingGroup, bookings: Booking[]): GroupSummary {
  const members = bookingsForGroup(bookings, group.id);
  const cancelledCount = members.filter((booking) => booking.status === 'cancelled').length;
  const amount = members
    .filter((booking) => booking.status !== 'cancelled')
    .reduce((sum, booking) => sum + booking.total, 0);
  return { group, bookings: members, bookingsCount: members.length, cancelledCount, amount };
}

/** Bookings free to be attached to a group: this hotel's own, not cancelled, not already in a (different) group. */
export function attachableBookings(bookings: Booking[], hotelId: string, groupId: string): Booking[] {
  return bookings
    .filter((booking) => booking.hotelId === hotelId && booking.status !== 'cancelled')
    .filter((booking) => !booking.groupId || booking.groupId === groupId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function matchesQuery(group: BookingGroup, query: string): boolean {
  const needle = query.toLowerCase();
  return group.name.toLowerCase().includes(needle) || (group.notes ?? '').toLowerCase().includes(needle);
}

export function searchGroups(groups: BookingGroup[], query: string): BookingGroup[] {
  const trimmed = query.trim();
  return trimmed ? groups.filter((group) => matchesQuery(group, trimmed)) : groups;
}
