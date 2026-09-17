import { mergeCatalog } from '../domain/catalog-overlay';
import type { CatalogEntryRecord, DemoControlPort, HotelRepository } from '../domain/ports';
import type { AddOn, Hotel, PhysicalRoom, RatePlan, RoomType } from '../domain/schemas';
import { getDemoDatabase } from './cloudflare-env';
import * as d1 from './d1-hotel-repository';
import { durableCatalogContentPort } from './durable-catalog-content';
import { demoHotels } from './mock-data';
import { mockAvailability, mockDemoControlPort, mockHotelRepository } from './mock-hotel-repository';

/**
 * The repository and control port the app actually uses. Every durable
 * method resolves the D1 binding at call time — never once at module load,
 * since `env` bindings are only guaranteed once a request is in flight — and
 * reads through D1 when one is configured, falling back to the in-memory
 * mock otherwise (no hosting.json d1 binding, or running outside workerd).
 *
 * getHotel/listRooms/listPhysicalRooms/listRatePlans/listAddOns read the
 * static seed (mock-data.ts) and merge the CMS overlay
 * (`durableCatalogContentPort`, itself D1-or-in-memory the same way) on top —
 * see `lib/domain/catalog-overlay.ts`. Nothing else in this file's booking
 * state is affected: only what `/admin/content` can edit is overlaid.
 */
export const durableHotelRepository: HotelRepository = {
  async getHotel(slug) {
    const seed = await mockHotelRepository.getHotel(slug);
    if (!seed) return null;
    const overlay = (await durableCatalogContentPort.listEntries(
      'hotel',
      seed.id,
    )) as CatalogEntryRecord<Hotel>[];
    return mergeCatalog([seed], overlay)[0] ?? seed;
  },

  async listRooms(hotelId) {
    const seed = await mockHotelRepository.listRooms(hotelId);
    const overlay = (await durableCatalogContentPort.listEntries(
      'room',
      hotelId,
    )) as CatalogEntryRecord<RoomType>[];
    return mergeCatalog(seed, overlay);
  },

  async listPhysicalRooms(hotelId) {
    const seed = await mockHotelRepository.listPhysicalRooms(hotelId);
    const overlay = (await durableCatalogContentPort.listEntries(
      'unit',
      hotelId,
    )) as CatalogEntryRecord<PhysicalRoom>[];
    return mergeCatalog(seed, overlay);
  },

  async listRatePlans(roomTypeId) {
    const seed = await mockHotelRepository.listRatePlans(roomTypeId);
    // Rate overlay rows are keyed to a hotel, then narrowed to this room
    // type — there is no per-room-type overlay listing, so every seed
    // hotel's overlay is checked and the room type's own id picks out the
    // right rows (CMS edits only ever land under one hotel today, but this
    // stays correct once a second one can take them too).
    const overlay = (
      await Promise.all(
        demoHotels.map(
          (hotel) =>
            durableCatalogContentPort.listEntries('rate', hotel.id) as Promise<CatalogEntryRecord<RatePlan>[]>,
        ),
      )
    ).flat();
    const relevant = overlay.filter((entry) => entry.data.roomTypeId === roomTypeId);
    return mergeCatalog(seed, relevant);
  },

  async listAddOns(hotelId) {
    const seed = await mockHotelRepository.listAddOns(hotelId);
    const overlay = (await durableCatalogContentPort.listEntries(
      'addon',
      hotelId,
    )) as CatalogEntryRecord<AddOn>[];
    return mergeCatalog(seed, overlay);
  },

  async getAvailability(roomTypeId, from, to) {
    // Rooms are keyed to a hotel, like rates above. Counting the merged list
    // across every seed hotel is what keeps the CMS's rooms and the rooms on
    // sale equal, whichever hotel this room type belongs to.
    const rooms = (
      await Promise.all(demoHotels.map((hotel) => durableHotelRepository.listPhysicalRooms(hotel.id)))
    ).flat();
    const units = rooms.filter((room) => room.roomTypeId === roomTypeId).length;
    const db = getDemoDatabase();
    return db
      ? d1.getAvailability(db, roomTypeId, units, from, to)
      : mockAvailability(roomTypeId, units, from, to);
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
  cancelBooking(reference) {
    const db = getDemoDatabase();
    return db ? d1.cancelBooking(db, reference) : mockHotelRepository.cancelBooking(reference);
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
  listIntegrationStatuses: () => mockDemoControlPort.listIntegrationStatuses(),
  reset() {
    const db = getDemoDatabase();
    return db ? d1.reset(db) : mockDemoControlPort.reset();
  },
};
