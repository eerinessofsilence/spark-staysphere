import { addDays, format, parseISO } from 'date-fns';
import type { DemoControlPort, HotelRepository } from '../domain/ports';
import type {
  Availability,
  Booking,
  IntegrationStatus,
  PaymentAttempt,
  RoomStatus,
} from '../domain/schemas';
import { demoAddOns, demoHotel, demoRates, demoRooms } from './mock-data';

/**
 * Process-local demo state. It resets with the worker isolate; production swaps
 * this module for a Postgres-backed repository behind the same port.
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

/** Physical units per room type. Rarer rooms sell out more often in the demo. */
const baseUnits: Record<string, number> = {
  'room_deluxe-sea': 8,
  'room_garden-studio': 7,
  'room_panorama-suite': 4,
  'room_pool-terrace': 6,
  'room_family-residence': 4,
  'room_skyline-loft': 5,
  'room_coastal-twin': 8,
  'room_asteria-penthouse': 2,
};

function unitsFor(roomTypeId: string): number {
  return baseUnits[roomTypeId] ?? 5;
}

/** Stable 32-bit hash so availability is identical on server render and reload. */
function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}

export function statusForRemaining(remaining: number): RoomStatus {
  if (remaining <= 0) return 'sold_out';
  if (remaining === 1) return 'last_room';
  if (remaining <= 3) return 'limited';
  return 'available';
}

function nightsInRange(from: string, to: string): string[] {
  const start = parseISO(from);
  const end = parseISO(to);
  if (Number.isNaN(start.getTime())) return [];
  if (Number.isNaN(end.getTime()) || end <= start) return [format(start, 'yyyy-MM-dd')];

  const dates: string[] = [];
  for (let cursor = start; cursor < end; cursor = addDays(cursor, 1)) {
    dates.push(format(cursor, 'yyyy-MM-dd'));
    if (dates.length > 60) break;
  }
  return dates;
}

function remainingOn(roomTypeId: string, date: string): number {
  const override = roomStatusOverrides.get(roomTypeId);
  const units = unitsFor(roomTypeId);
  if (override === 'sold_out') return 0;
  if (override === 'last_room') return 1;
  if (override === 'limited') return Math.min(units, 2);
  if (override === 'available') return units;

  // Cubed load skews occupancy low, so most nights are sellable and scarcity
  // states stay rare enough to be a demonstration rather than a dead end.
  const load = (hash(`${roomTypeId}|${date}`) % 100) / 100;
  const taken = Math.round(units * load ** 3);
  const held = demoHolds.get(`${roomTypeId}|${date}`) ?? 0;
  return Math.max(0, units - taken - held);
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
