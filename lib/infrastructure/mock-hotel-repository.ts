import type { DemoControlPort, HotelRepository } from '../domain/ports';
import type {
  Availability,
  Booking,
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
  async saveBooking(booking) {
    bookingsByIdempotencyKey.set(booking.idempotencyKey, booking);
    bookingsByReference.set(booking.reference, booking);
    if (booking.status === 'confirmed') {
      for (const date of nightsInRange(booking.checkIn, booking.checkOut)) {
        const key = `${booking.roomTypeId}|${date}`;
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
        const key = `${booking.roomTypeId}|${date}`;
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
  async listBookings() {
    return [...bookingsByReference.values()].map(withGroup).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
    paymentAttempts.set(attempt.bookingId, [...existing, attempt]);
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
