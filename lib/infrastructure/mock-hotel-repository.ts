import type { DemoControlPort, HotelRepository } from '../domain/ports';
import type {
  Availability,
  Booking,
  BookingRoomAssignment,
  BookingGroup,
  GuestProfile,
  IntegrationStatus,
  PaymentAttempt,
  RoomStatus,
} from '../domain/schemas';
import { nightsInRange, resolveRemaining, statusForRemaining } from '../domain/availability';
import { demoAddOns, demoHotels, demoPhysicalRooms, demoRates, demoRooms } from './mock-data';

/**
 * Process-local in-memory demo state. This is the fallback used whenever no
 * D1 binding is configured (see durable-hotel-repository.ts), and it is also
 * exactly what ran before persistence existed — bookings, overrides, and
 * holds here reset with the worker isolate. The catalog itself (including an
 * add-on's `enabled` flag and the physical rooms) is seed-only here; the CMS
 * overlay that can replace it lives in `catalog-content-mock.ts` and is
 * merged on top by `durable-hotel-repository.ts`.
 */
const bookingsByIdempotencyKey = new Map<string, Booking>();
const bookingsByReference = new Map<string, Booking>();
const paymentAttempts = new Map<string, PaymentAttempt[]>();
const roomStatusOverrides = new Map<string, RoomStatus>();
/** `${roomTypeId}|${yyyy-MM-dd}` → units taken by demo bookings made this session. */
const demoHolds = new Map<string, number>();
const bookingGroups = new Map<string, BookingGroup>();
const guestProfiles = new Map<string, GuestProfile>();
/** bookingId -> groupId */
const bookingGroupMembers = new Map<string, string>();

function withGroup(booking: Booking): Booking {
  const groupId = bookingGroupMembers.get(booking.id);
  return groupId ? { ...booking, groupId } : booking;
}

const integrationStatuses: IntegrationStatus[] = [
  { adapter: 'pms', mode: 'mock', connected: false, lastSyncAt: null },
  { adapter: 'channel_manager', mode: 'mock', connected: false, lastSyncAt: null },
  { adapter: 'booking_engine', mode: 'mock', connected: true, lastSyncAt: null },
  { adapter: 'payment', mode: 'mock', connected: true, lastSyncAt: null },
  { adapter: 'crm', mode: 'mock', connected: false, lastSyncAt: null },
];

/**
 * Availability for a room type with `units` rooms. The count comes from the
 * caller — `durable-hotel-repository.ts` counts the stored rooms, CMS overlay
 * included — so this never has to know where the rooms came from.
 */
export function mockAvailability(roomTypeId: string, units: number, from: string, to: string): Availability[] {
  const override = roomStatusOverrides.get(roomTypeId) ?? null;
  return nightsInRange(from, to).map((date): Availability => {
    const held = demoHolds.get(`${roomTypeId}|${date}`) ?? 0;
    const remaining = resolveRemaining(roomTypeId, units, date, override, held);
    return { roomTypeId, date, remaining, status: statusForRemaining(remaining) };
  });
}

export const mockHotelRepository: HotelRepository = {
  async getHotel(slug) {
    return demoHotels.find((hotel) => hotel.slug === slug) ?? null;
  },
  async listRooms(hotelId) {
    return demoRooms.filter((room) => room.hotelId === hotelId);
  },
  async listPhysicalRooms(hotelId) {
    return demoPhysicalRooms.filter((room) => room.hotelId === hotelId);
  },
  async listRatePlans(roomTypeId) {
    return demoRates.filter((rate) => rate.roomTypeId === roomTypeId);
  },
  async listAddOns(hotelId) {
    if (!demoHotels.some((hotel) => hotel.id === hotelId)) return [];
    return demoAddOns.map((addOn) => ({ ...addOn }));
  },
  async getAvailability(roomTypeId, from, to) {
    const units = demoPhysicalRooms.filter((room) => room.roomTypeId === roomTypeId).length;
    return mockAvailability(roomTypeId, units, from, to);
  },
  async findBookingByIdempotencyKey(key) {
    return bookingsByIdempotencyKey.get(key) ?? null;
  },
  async saveBooking(booking, inventoryCapacity) {
    const replay = bookingsByIdempotencyKey.get(booking.idempotencyKey);
    if (replay) return replay;
    if (booking.status === 'confirmed' && inventoryCapacity !== undefined) {
      const conflict = nightsInRange(booking.checkIn, booking.checkOut).some((date) =>
        (demoHolds.get(`${booking.roomTypeId}|${date}`) ?? 0) >= inventoryCapacity,
      ) || Boolean(booking.unitNumber && [...bookingsByReference.values()].some((existing) =>
        existing.status === 'confirmed' && existing.hotelId === booking.hotelId &&
        (existing.roomAssignments?.length
          ? existing.roomAssignments.some((period) => period.roomNumber === booking.unitNumber &&
              period.fromDate < booking.checkOut && period.toDate > booking.checkIn)
          : existing.unitNumber === booking.unitNumber && existing.checkIn < booking.checkOut && existing.checkOut > booking.checkIn),
      ));
      if (conflict) {
        const error = new Error('Room inventory changed before confirmation.');
        error.name = 'BookingInventoryConflictError';
        throw error;
      }
    }
    bookingsByIdempotencyKey.set(booking.idempotencyKey, booking);
    bookingsByReference.set(booking.reference, booking);
    if (booking.status === 'confirmed') {
      for (const date of nightsInRange(booking.checkIn, booking.checkOut)) {
        const typeId = booking.roomAssignments?.find((period) => period.fromDate <= date && date < period.toDate)?.roomTypeId
          ?? booking.roomTypeId;
        const key = `${typeId}|${date}`;
        demoHolds.set(key, (demoHolds.get(key) ?? 0) + 1);
      }
    }
    return booking;
  },
  async getBookingByReference(reference) {
    const booking = bookingsByReference.get(reference);
    return booking ? withGroup(booking) : null;
  },
  async cancelBooking(reference) {
    const booking = bookingsByReference.get(reference);
    if (!booking) return null;
    if (booking.status === 'cancelled') return booking;

    const cancelled: Booking = { ...booking, status: 'cancelled' };
    bookingsByReference.set(reference, cancelled);
    bookingsByIdempotencyKey.set(cancelled.idempotencyKey, cancelled);
    // Only a confirmed booking ever took a night out of inventory.
    if (booking.status === 'confirmed') {
      for (const date of nightsInRange(booking.checkIn, booking.checkOut)) {
        const typeId = booking.roomAssignments?.find((period) => period.fromDate <= date && date < period.toDate)?.roomTypeId
          ?? booking.roomTypeId;
        const key = `${typeId}|${date}`;
        demoHolds.set(key, Math.max(0, (demoHolds.get(key) ?? 0) - 1));
      }
    }
    return cancelled;
  },
  async setBookingStayState(reference, state) {
    const booking = bookingsByReference.get(reference);
    if (!booking) return null;
    const updated: Booking = { ...booking, stayState: state };
    bookingsByReference.set(reference, updated);
    bookingsByIdempotencyKey.set(updated.idempotencyKey, updated);
    return updated;
  },
  async saveBookingRoomAssignments(bookingId, assignments: BookingRoomAssignment[]) {
    const booking = [...bookingsByReference.values()].find((candidate) => candidate.id === bookingId);
    if (!booking) return false;
    const updated: Booking = { ...booking, roomAssignments: assignments };
    bookingsByReference.set(updated.reference, updated);
    bookingsByIdempotencyKey.set(updated.idempotencyKey, updated);
    return true;
  },
  async transferBookingRoomType(input) {
    const booking = [...bookingsByReference.values()].find((item) => item.id === input.bookingId);
    if (!booking || booking.status !== 'confirmed' || booking.roomTypeId !== input.expectedRoomTypeId ||
      booking.total !== input.expectedTotal || booking.checkOut !== input.checkOut) return false;
    if (booking.roomAssignments?.length && !booking.roomAssignments.some((period) =>
      period.roomNumber === input.sourceRoomNumber &&
      (period.roomTypeId ?? booking.roomTypeId) === input.sourceRoomTypeId &&
      period.fromDate <= input.fromDate && input.fromDate < period.toDate)) return false;
    const movedNights = Object.values(input.oldNightsByType).flat();
    if (movedNights.length === 0 || movedNights.some((night) =>
      (demoHolds.get(`${input.targetRoomTypeId}|${night}`) ?? 0) >= input.capacity,
    )) return false;
    const occupied = [...bookingsByReference.values()].some((item) => item.id !== booking.id &&
      item.hotelId === booking.hotelId && item.status === 'confirmed' &&
      (item.roomAssignments?.length
        ? item.roomAssignments.some((period) => period.roomNumber === input.targetRoomNumber &&
            period.fromDate < input.checkOut && period.toDate > input.fromDate)
        : item.unitNumber === input.targetRoomNumber && item.checkIn < input.checkOut && item.checkOut > input.fromDate));
    if (occupied) return false;
    for (const [typeId, nights] of Object.entries(input.oldNightsByType)) {
      for (const night of nights) {
        const key = `${typeId}|${night}`;
        demoHolds.set(key, Math.max(0, (demoHolds.get(key) ?? 0) - 1));
      }
    }
    for (const night of movedNights) {
      const key = `${input.targetRoomTypeId}|${night}`;
      demoHolds.set(key, (demoHolds.get(key) ?? 0) + 1);
    }
    const updated: Booking = {
      ...booking,
      roomTypeId: input.targetRoomTypeId,
      ratePlanId: input.targetRatePlanId,
      total: input.newTotal,
      unitNumber: input.targetRoomNumber,
      roomAssignments: input.assignments,
    };
    bookingsByReference.set(updated.reference, updated);
    bookingsByIdempotencyKey.set(updated.idempotencyKey, updated);
    return true;
  },
  async listBookings(options = {}) {
    const items = [...bookingsByReference.values()].map(withGroup)
      .filter((booking) => !options.hotelId || booking.hotelId === options.hotelId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return options.limit === undefined ? items : items.slice(0, Math.max(0, options.limit));
  },
  async createBookingGroup(group) {
    bookingGroups.set(group.id, group);
    return group;
  },
  async listBookingGroups(hotelId) {
    return [...bookingGroups.values()]
      .filter((group) => group.hotelId === hotelId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async getBookingGroup(id) {
    return bookingGroups.get(id) ?? null;
  },
  async assignBookingToGroup(bookingId, groupId) {
    const booking = [...bookingsByReference.values()].find((candidate) => candidate.id === bookingId);
    if (!booking) return null;
    bookingGroupMembers.set(bookingId, groupId);
    return withGroup(booking);
  },
  async removeBookingFromGroup(bookingId) {
    const booking = [...bookingsByReference.values()].find((candidate) => candidate.id === bookingId);
    if (!booking) return null;
    bookingGroupMembers.delete(bookingId);
    return { ...booking, groupId: undefined };
  },
  async deleteBookingGroup(id) {
    bookingGroups.delete(id);
    for (const [bookingId, groupId] of bookingGroupMembers) {
      if (groupId === id) bookingGroupMembers.delete(bookingId);
    }
  },
  async createGuestProfile(profile) {
    guestProfiles.set(profile.id, profile);
    return profile;
  },
  async deleteGuestProfile(profileId, hotelId) {
    const profile = guestProfiles.get(profileId);
    if (profile?.hotelId === hotelId) guestProfiles.delete(profileId);
  },
  async anonymizeGuestBookings(hotelId, email) {
    let count = 0;
    for (const [reference, booking] of bookingsByReference) {
      if (booking.hotelId === hotelId && booking.guest.email.trim().toLowerCase() === email.trim().toLowerCase()) {
        bookingsByReference.set(reference, { ...booking, guest: { ...booking.guest, firstName: 'Deleted', lastName: 'Guest', email: `deleted+${booking.id}@invalid.local`, phone: '0000000' } }); count += 1;
      }
    }
    return count;
  },
  async saveGuestIdentity(profileId, hotelId, identity) {
    const profile = guestProfiles.get(profileId);
    if (profile?.hotelId === hotelId) guestProfiles.set(profileId, { ...profile, firstName: identity.firstName, lastName: identity.lastName, identity });
  },
  async listGuestProfiles(hotelId) {
    return [...guestProfiles.values()]
      .filter((profile) => profile.hotelId === hotelId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async savePaymentAttempt(attempt) {
    const existing = paymentAttempts.get(attempt.bookingId) ?? [];
    if (!existing.some((item) => item.id === attempt.id)) paymentAttempts.set(attempt.bookingId, [...existing, attempt]);
    return attempt;
  },
  async listPaymentAttempts(bookingId) {
    return paymentAttempts.get(bookingId) ?? [];
  },
};

export const mockDemoControlPort: DemoControlPort = {
  async setRoomStatusOverride(roomTypeId, status) {
    if (status === null) roomStatusOverrides.delete(roomTypeId);
    else roomStatusOverrides.set(roomTypeId, status);
  },
  async getRoomStatusOverride(roomTypeId) {
    return roomStatusOverrides.get(roomTypeId) ?? null;
  },
  async listIntegrationStatuses() {
    return integrationStatuses.map((status) => ({ ...status }));
  },
  async reset() {
    bookingsByIdempotencyKey.clear();
    bookingsByReference.clear();
    paymentAttempts.clear();
    roomStatusOverrides.clear();
    demoHolds.clear();
    bookingGroups.clear();
    bookingGroupMembers.clear();
    guestProfiles.clear();
  },
};
