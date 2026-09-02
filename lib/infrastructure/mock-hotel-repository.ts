import type { DemoControlPort, HotelRepository } from '../domain/ports';
import type {
  Availability,
  Booking,
  IntegrationStatus,
  PaymentAttempt,
  RoomStatus,
} from '../domain/schemas';
import { nightsInRange, resolveRemaining, statusForRemaining } from '../domain/availability';
import { demoAddOns, demoHotel, demoRates, demoRooms } from './mock-data';

/**
 * Process-local in-memory demo state. This is the fallback used whenever no
 * D1 binding is configured (see durable-hotel-repository.ts), and it is also
 * exactly what ran before persistence existed — bookings, overrides, and
 * holds here reset with the worker isolate.
 */
const bookingsByIdempotencyKey = new Map<string, Booking>();
const bookingsByReference = new Map<string, Booking>();
const paymentAttempts = new Map<string, PaymentAttempt[]>();
const roomStatusOverrides = new Map<string, RoomStatus>();
const addOnEnabled = new Map<string, boolean>();
/** `${roomTypeId}|${yyyy-MM-dd}` → units taken by demo bookings made this session. */
const demoHolds = new Map<string, number>();

const integrationStatuses: IntegrationStatus[] = [
  { adapter: 'pms', mode: 'mock', connected: false, lastSyncAt: null },
  { adapter: 'channel_manager', mode: 'mock', connected: false, lastSyncAt: null },
  { adapter: 'booking_engine', mode: 'mock', connected: true, lastSyncAt: null },
  { adapter: 'payment', mode: 'mock', connected: true, lastSyncAt: null },
  { adapter: 'crm', mode: 'mock', connected: false, lastSyncAt: null },
];

function remainingOn(roomTypeId: string, date: string): number {
  const override = roomStatusOverrides.get(roomTypeId) ?? null;
  const held = demoHolds.get(`${roomTypeId}|${date}`) ?? 0;
  return resolveRemaining(roomTypeId, date, override, held);
}

export const mockHotelRepository: HotelRepository = {
  async getHotel(slug) {
    return slug === demoHotel.slug ? demoHotel : null;
  },
  async listRooms(hotelId) {
    return demoRooms.filter((room) => room.hotelId === hotelId);
  },
  async listRatePlans(roomTypeId) {
    return demoRates.filter((rate) => rate.roomTypeId === roomTypeId);
  },
  async listAddOns(hotelId) {
    if (hotelId !== demoHotel.id) return [];
    return demoAddOns.map((addOn) => ({
      ...addOn,
      enabled: addOnEnabled.get(addOn.id) ?? addOn.enabled,
    }));
  },
  async getAvailability(roomTypeId, from, to) {
    if (!demoRooms.some((room) => room.id === roomTypeId)) return [];
    return nightsInRange(from, to).map((date): Availability => {
      const remaining = remainingOn(roomTypeId, date);
      return { roomTypeId, date, remaining, status: statusForRemaining(remaining) };
    });
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
    return bookingsByReference.get(reference) ?? null;
  },
  async listBookings() {
    return [...bookingsByReference.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
  async setAddOnEnabled(addOnId, enabled) {
    addOnEnabled.set(addOnId, enabled);
  },
  async listIntegrationStatuses() {
    return integrationStatuses.map((status) => ({ ...status }));
  },
  async reset() {
    bookingsByIdempotencyKey.clear();
    bookingsByReference.clear();
    paymentAttempts.clear();
    roomStatusOverrides.clear();
    addOnEnabled.clear();
    demoHolds.clear();
  },
};
