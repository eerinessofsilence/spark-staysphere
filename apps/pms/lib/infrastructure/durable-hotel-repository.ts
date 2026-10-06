import { mergeCatalog } from '../domain/catalog-overlay';
import type { CatalogEntryRecord, DemoControlPort, HotelRepository } from '../domain/ports';
import type { AddOn, Hotel, PhysicalRoom, RatePlan, RoomType } from '../domain/schemas';
import { getDemoDatabase } from './cloudflare-env';
import * as d1 from './d1-hotel-repository';
import { durableCatalogContentPort } from './durable-catalog-content';
import { demoHotel, demoRooms } from './mock-data';
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

/**
 * Which hotel a room type belongs to, from the static seed alone — no D1
 * round trip. A room type the CMS created isn't in that seed; the CMS only
 * ever writes against the default hotel (content-service.ts's one bound
 * `hotelSlug`), so that's the correct fallback, not a guess. Querying every
 * seed hotel's overlay on every rate/availability lookup used to do exactly
 * that instead, and multiplied this file's D1 calls by the hotel count —
 * enough on a 23-room-type hotel to trip a Worker's resource limit.
 */
function ownerHotelId(roomTypeId: string): string {
  return demoRooms.find((room) => room.id === roomTypeId)?.hotelId ?? demoHotel.id;
}

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
    // CMS-created room types are the records an operator just added, so keep
    // them above the demo seed catalog. Among new types, the most recently
    // created/updated entry comes first; seed entries keep their curated order.
    return mergeCatalog(seed, overlay, { newEntriesFirst: true });
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
    // type — there is no per-room-type overlay listing, so the room type's
    // own hotel picks out the right bucket and its own id picks out the
    // right rows within it.
    const overlay = (await durableCatalogContentPort.listEntries(
      'rate',
      ownerHotelId(roomTypeId),
    )) as CatalogEntryRecord<RatePlan>[];
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
    // for that one hotel is what keeps the CMS's rooms and the rooms on
    // sale equal.
    const rooms = await durableHotelRepository.listPhysicalRooms(ownerHotelId(roomTypeId));
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
  saveBooking(booking, inventoryCapacity) {
    const db = getDemoDatabase();
    return db ? d1.saveBooking(db, booking, inventoryCapacity) : mockHotelRepository.saveBooking(booking, inventoryCapacity);
  },
  saveBookingRoomAssignments(bookingId, assignments) {
    const db = getDemoDatabase();
    return db
      ? d1.saveBookingRoomAssignments(db, bookingId, assignments)
      : mockHotelRepository.saveBookingRoomAssignments(bookingId, assignments);
  },
  transferBookingRoomType(input) {
    const db = getDemoDatabase();
    return db ? d1.transferBookingRoomType(db, input) : mockHotelRepository.transferBookingRoomType(input);
  },
  changeBookingStayDates(input) {
    const db = getDemoDatabase();
    return db ? d1.changeBookingStayDates(db, input) : mockHotelRepository.changeBookingStayDates(input);
  },
  changeBookingStayTimes(input) {
    const db = getDemoDatabase();
    return db ? d1.changeBookingStayTimes(db, input) : mockHotelRepository.changeBookingStayTimes(input);
  },
  getBookingByReference(reference) {
    const db = getDemoDatabase();
    return db ? d1.getBookingByReference(db, reference) : mockHotelRepository.getBookingByReference(reference);
  },
  listBookingGuests(bookingId) {
    const db = getDemoDatabase();
    return db ? d1.listBookingGuests(db, bookingId) : mockHotelRepository.listBookingGuests(bookingId);
  },
  addBookingGuest(guest, hotelId) {
    const db = getDemoDatabase();
    return db ? d1.addBookingGuest(db, guest, hotelId) : mockHotelRepository.addBookingGuest(guest, hotelId);
  },
  cancelBooking(reference, reason) {
    const db = getDemoDatabase();
    return db ? d1.cancelBooking(db, reference, reason) : mockHotelRepository.cancelBooking(reference, reason);
  },
  setBookingStayState(reference, state) {
    const db = getDemoDatabase();
    return db
      ? d1.setBookingStayState(db, reference, state)
      : mockHotelRepository.setBookingStayState(reference, state);
  },
  listBookings(options) {
    const db = getDemoDatabase();
    return db ? d1.listBookings(db, options) : mockHotelRepository.listBookings(options);
  },
  savePaymentAttempt(attempt) {
    const db = getDemoDatabase();
    return db ? d1.savePaymentAttempt(db, attempt) : mockHotelRepository.savePaymentAttempt(attempt);
  },
  listPaymentAttempts(bookingId) {
    const db = getDemoDatabase();
    return db ? d1.listPaymentAttempts(db, bookingId) : mockHotelRepository.listPaymentAttempts(bookingId);
  },
  createBookingGroup(group) {
    const db = getDemoDatabase();
    return db ? d1.createBookingGroup(db, group) : mockHotelRepository.createBookingGroup(group);
  },
  listBookingGroups(hotelId) {
    const db = getDemoDatabase();
    return db ? d1.listBookingGroups(db, hotelId) : mockHotelRepository.listBookingGroups(hotelId);
  },
  getBookingGroup(id) {
    const db = getDemoDatabase();
    return db ? d1.getBookingGroup(db, id) : mockHotelRepository.getBookingGroup(id);
  },
  assignBookingToGroup(bookingId, groupId) {
    const db = getDemoDatabase();
    return db ? d1.assignBookingToGroup(db, bookingId, groupId) : mockHotelRepository.assignBookingToGroup(bookingId, groupId);
  },
  removeBookingFromGroup(bookingId) {
    const db = getDemoDatabase();
    return db ? d1.removeBookingFromGroup(db, bookingId) : mockHotelRepository.removeBookingFromGroup(bookingId);
  },
  deleteBookingGroup(id) {
    const db = getDemoDatabase();
    return db ? d1.deleteBookingGroup(db, id) : mockHotelRepository.deleteBookingGroup(id);
  },
  createGuestProfile(profile) {
    const db = getDemoDatabase();
    return db ? d1.createGuestProfile(db, profile) : mockHotelRepository.createGuestProfile(profile);
  },
  deleteGuestProfile(profileId, hotelId) {
    const db = getDemoDatabase();
    return db ? d1.deleteGuestProfile(db, profileId, hotelId) : mockHotelRepository.deleteGuestProfile(profileId, hotelId);
  },
  anonymizeGuestBookings(hotelId, email) {
    const db = getDemoDatabase();
    return db ? d1.anonymizeGuestBookings(db, hotelId, email) : mockHotelRepository.anonymizeGuestBookings(hotelId, email);
  },
  saveGuestIdentity(profileId, hotelId, identity) {
    const db = getDemoDatabase();
    return db ? d1.saveGuestIdentity(db, profileId, hotelId, identity) : mockHotelRepository.saveGuestIdentity(profileId, hotelId, identity);
  },
  listGuestProfiles(hotelId) {
    const db = getDemoDatabase();
    return db ? d1.listGuestProfiles(db, hotelId) : mockHotelRepository.listGuestProfiles(hotelId);
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
