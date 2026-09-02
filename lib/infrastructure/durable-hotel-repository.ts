import type { DemoControlPort, HotelRepository } from '../domain/ports';
import { getDemoDatabase } from './cloudflare-env';
import * as d1 from './d1-hotel-repository';
import { mockDemoControlPort, mockHotelRepository } from './mock-hotel-repository';

/**
 * The repository and control port the app actually uses. Every durable
 * method resolves the D1 binding at call time — never once at module load,
 * since `env` bindings are only guaranteed once a request is in flight — and
 * reads through D1 when one is configured, falling back to the in-memory
 * mock otherwise (no hosting.json d1 binding, or running outside workerd).
 *
 * getHotel/listRooms/listRatePlans never touch either backend's state: the
 * room/rate catalog is static seed data that no guest or admin action
 * mutates, so there's nothing to persist for it.
 */
export const durableHotelRepository: HotelRepository = {
  getHotel: (slug) => mockHotelRepository.getHotel(slug),
  listRooms: (hotelId) => mockHotelRepository.listRooms(hotelId),
  listRatePlans: (roomTypeId) => mockHotelRepository.listRatePlans(roomTypeId),

  listAddOns(hotelId) {
    const db = getDemoDatabase();
    return db ? d1.listAddOns(db, hotelId) : mockHotelRepository.listAddOns(hotelId);
  },
  getAvailability(roomTypeId, from, to) {
    const db = getDemoDatabase();
    return db
      ? d1.getAvailability(db, roomTypeId, from, to)
      : mockHotelRepository.getAvailability(roomTypeId, from, to);
  },
  findBookingByIdempotencyKey(key) {
    const db = getDemoDatabase();
    return db ? d1.findBookingByIdempotencyKey(db, key) : mockHotelRepository.findBookingByIdempotencyKey(key);
  },
  saveBooking(booking) {
    const db = getDemoDatabase();
    return db ? d1.saveBooking(db, booking) : mockHotelRepository.saveBooking(booking);
  },
  getBookingByReference(reference) {
    const db = getDemoDatabase();
    return db ? d1.getBookingByReference(db, reference) : mockHotelRepository.getBookingByReference(reference);
  },
  listBookings() {
    const db = getDemoDatabase();
    return db ? d1.listBookings(db) : mockHotelRepository.listBookings();
  },
  savePaymentAttempt(attempt) {
    const db = getDemoDatabase();
    return db ? d1.savePaymentAttempt(db, attempt) : mockHotelRepository.savePaymentAttempt(attempt);
  },
  listPaymentAttempts(bookingId) {
    const db = getDemoDatabase();
    return db ? d1.listPaymentAttempts(db, bookingId) : mockHotelRepository.listPaymentAttempts(bookingId);
  },
};

export const durableDemoControlPort: DemoControlPort = {
  setRoomStatusOverride(roomTypeId, status) {
    const db = getDemoDatabase();
    return db
      ? d1.setRoomStatusOverride(db, roomTypeId, status)
      : mockDemoControlPort.setRoomStatusOverride(roomTypeId, status);
  },
  getRoomStatusOverride(roomTypeId) {
    const db = getDemoDatabase();
    return db ? d1.getRoomStatusOverride(db, roomTypeId) : mockDemoControlPort.getRoomStatusOverride(roomTypeId);
  },
  setAddOnEnabled(addOnId, enabled) {
    const db = getDemoDatabase();
    return db ? d1.setAddOnEnabled(db, addOnId, enabled) : mockDemoControlPort.setAddOnEnabled(addOnId, enabled);
  },
  listIntegrationStatuses: () => mockDemoControlPort.listIntegrationStatuses(),
  reset() {
    const db = getDemoDatabase();
    return db ? d1.reset(db) : mockDemoControlPort.reset();
  },
};
