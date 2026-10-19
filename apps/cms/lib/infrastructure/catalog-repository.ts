import { mergeCatalog } from '../domain/catalog-overlay';
import type { CatalogEntryKind, CatalogEntryRecord, CatalogReader } from '../domain/ports';
import type { AddOn, Hotel, PhysicalRoom, RatePlan, RoomType } from '../domain/schemas';
import { durableCatalogContentPort as content } from './durable-catalog-content';
import { demoHotel, demoRooms, demoPhysicalRooms, demoRates, demoAddOns } from './mock-data';

async function merge<T extends { id: string }>(kind: CatalogEntryKind, hotelId: string, seed: T[]) {
  return mergeCatalog(seed, await content.listEntries(kind, hotelId) as CatalogEntryRecord<T>[], { newEntriesFirst: kind === 'room' });
}
export const catalogRepository: CatalogReader = {
  async getHotel(slug) {
    if (slug !== demoHotel.slug) return null;
    return (await merge<Hotel>('hotel', demoHotel.id, [demoHotel]))[0] ?? null;
  },
  async listRooms(hotelId) { return merge<RoomType>('room', hotelId, demoRooms.filter((room) => room.hotelId === hotelId)); },
  async listPhysicalRooms(hotelId) { return merge<PhysicalRoom>('unit', hotelId, demoPhysicalRooms.filter((room) => room.hotelId === hotelId)); },
  async listRatePlans(roomTypeId) {
    return (await merge<RatePlan>('rate', demoHotel.id, demoRates.filter((rate) => rate.roomTypeId === roomTypeId))).filter((rate) => rate.roomTypeId === roomTypeId);
  },
  async listAddOns(hotelId) { return merge<AddOn>('addon', hotelId, hotelId === demoHotel.id ? demoAddOns : []); },
};
