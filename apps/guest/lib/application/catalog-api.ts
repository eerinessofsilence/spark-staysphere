import { getCatalog, type Catalog, type CatalogRoom } from './cms-api';
import type { CatalogFacets, DiningMenu, FloorPlan, RoomDetail, RoomFilters, SearchResult } from './guest-contracts';
import { roomCategory } from '../domain/room-attributes';
import { byRoomNumber, facadeOf } from '../domain/room-units';
import { buildPriceBreakdown, nightsBetween } from '../domain/pricing';
import type { Quote, RatePlan, RoomOffer, StayCriteria } from '../domain/schemas';

export class CatalogApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function catalogFor(slug: string): Promise<Catalog> {
  const catalog = await getCatalog();
  if (catalog.hotel.slug !== slug) throw new CatalogApiError('Hotel not found.', 404);
  return catalog;
}

export async function getPublicHotel(slug: string) { return (await catalogFor(slug)).hotel; }
export async function getPublicSpinnerZones(slug: string) { return (await catalogFor(slug)).zones; }
export async function getPublicDiningMenu(slug: string): Promise<DiningMenu> {
  const { hotel, addOns } = await catalogFor(slug);
  return { hotel, items: addOns };
}

function rateFor(catalog: Catalog, room: CatalogRoom): RatePlan {
  return [...catalog.rates].filter((rate) => rate.roomTypeId === room.id)
    .sort((a, b) => a.nightlyPrice - b.nightlyPrice)[0] ?? {
      id: `reference_${room.id}`, roomTypeId: room.id, name: room.name,
      nightlyPrice: 0, currency: catalog.hotel.currency, breakfastIncluded: false, includedServices: [],
    };
}

// These are display estimates from CMS reference prices, never inventory or a booking quote.
function offerFor(catalog: Catalog, room: CatalogRoom, criteria: StayCriteria, addOnIds: string[] = []): RoomOffer {
  const ratePlan = rateFor(catalog, room);
  return {
    room, ratePlan, referencePriceAvailable: room.referencePrice !== null,
    status: 'available', remaining: 0,
    price: buildPriceBreakdown({ ratePlan, addOns: catalog.addOns.filter((item) => addOnIds.includes(item.id)),
      nights: nightsBetween(criteria.checkIn, criteria.checkOut), adults: criteria.adults, children: criteria.children }),
  };
}

function matches(offer: RoomOffer, filters: RoomFilters): boolean {
  const { room, price } = offer;
  return (filters.minPrice === null || (offer.referencePriceAvailable && price.nightlyPrice >= filters.minPrice))
    && (filters.maxPrice === null || (offer.referencePriceAvailable && price.nightlyPrice <= filters.maxPrice))
    && (!filters.views.length || filters.views.includes(room.view))
    && (!filters.bedTypes.length || filters.bedTypes.includes(room.bedType))
    && (!filters.categories.length || filters.categories.includes(roomCategory(room)))
    && filters.amenities.every((amenity) => room.amenities.includes(amenity))
    && (filters.minArea === null || room.areaM2 >= filters.minArea)
    && (filters.minFloor === null || room.floor >= filters.minFloor);
}

function facetsFor(offers: RoomOffer[]): CatalogFacets {
  const rooms = offers.map((offer) => offer.room);
  const prices = offers.filter((offer) => offer.referencePriceAvailable).map((offer) => offer.price.nightlyPrice);
  const areas = rooms.map((room) => room.areaM2);
  return {
    amenities: [...new Set(rooms.flatMap((room) => room.amenities))].sort(),
    categories: [...new Set(rooms.map(roomCategory))], views: [...new Set(rooms.map((room) => room.view))],
    bedTypes: [...new Set(rooms.map((room) => room.bedType))],
    priceRange: { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 },
    areaRange: { min: areas.length ? Math.min(...areas) : 0, max: areas.length ? Math.max(...areas) : 0 },
    maxFloor: Math.max(0, ...catalogFloors(rooms)),
  };
}

function catalogFloors(rooms: Array<{ floor: number }>) { return rooms.map((room) => room.floor); }

export async function searchPublicRooms(slug: string, criteria: StayCriteria, filters: RoomFilters): Promise<SearchResult> {
  const catalog = await catalogFor(slug);
  const all = catalog.rooms.map((room) => offerFor(catalog, room, criteria));
  const offers = all.filter((offer) => offer.room.capacity >= criteria.adults + criteria.children && matches(offer, filters));
  offers.sort((a, b) => {
    if (filters.sort === 'area_desc') return b.room.areaM2 - a.room.areaM2;
    if (filters.sort === 'price_asc' || filters.sort === 'price_desc') {
      if (a.referencePriceAvailable !== b.referencePriceAvailable) return a.referencePriceAvailable ? -1 : 1;
      return (a.price.nightlyPrice - b.price.nightlyPrice) * (filters.sort === 'price_desc' ? -1 : 1);
    }
    const score = (offer: RoomOffer) => ({ sea: 12, pool: 9, garden: 6, city: 4 }[offer.room.view])
      + (offer.room.capacity === criteria.adults + criteria.children ? 8 : 0) + offer.room.areaM2 / 20;
    return score(b) - score(a);
  });
  return { hotel: catalog.hotel, criteria, offers, totalRooms: all.length, availableRooms: offers.length, facets: facetsFor(all) };
}

export async function getPublicRoomDetail(slug: string, roomSlug: string, criteria: StayCriteria, addOnIds: string[], unitNumber?: string | null): Promise<RoomDetail> {
  const catalog = await catalogFor(slug);
  const room = catalog.rooms.find((item) => item.slug === roomSlug);
  if (!room) throw new CatalogApiError('Room not found.', 404);
  const unit = unitNumber ? catalog.units.find((item) => item.number === unitNumber && item.roomTypeId === room.id) : undefined;
  if (unitNumber && !unit) throw new CatalogApiError('Room not found.', 404);
  const selected = catalog.addOns.filter((item) => addOnIds.includes(item.id) && (!item.parentId || addOnIds.includes(item.parentId)));
  const offer = offerFor(catalog, unit ? { ...room, name: `${room.name} · ${unit.number}`, floor: unit.floor, media: unit.media?.length ? unit.media : room.media } : room, criteria, selected.map((item) => item.id));
  const quote: Quote = {
    roomTypeId: room.id, ratePlanId: offer.ratePlan.id, ...criteria, addOnIds: selected.map((item) => item.id),
    referencePriceAvailable: offer.referencePriceAvailable, available: true, status: 'available', remaining: 0,
    price: offer.price, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  };
  return { hotel: catalog.hotel, offer, addOns: catalog.addOns, quote };
}

export async function getPublicFloorPlan(slug: string, criteria: StayCriteria, filters: RoomFilters): Promise<FloorPlan> {
  const catalog = await catalogFor(slug);
  const units = [...catalog.units].sort(byRoomNumber).flatMap((unit) => {
    const room = catalog.rooms.find((item) => item.id === unit.roomTypeId);
    if (!room) return [];
    const offer = offerFor(catalog, { ...room, floor: unit.floor }, criteria);
    const status = room.capacity < criteria.adults + criteria.children ? 'unsuitable' : matches(offer, filters) ? 'available' : 'filtered';
    return [{ number: unit.number, floor: unit.floor, facade: facadeOf(room.view), roomTypeId: room.id,
      roomSlug: room.slug, roomName: room.name, category: roomCategory(room), areaM2: room.areaM2,
      capacity: room.capacity, view: room.view, bedType: room.bedType, status,
      price: offer.referencePriceAvailable ? offer.price : null } satisfies FloorPlan['units'][number]];
  });
  return { hotel: catalog.hotel, criteria, units, floors: [...new Set(catalogFloors(units))].sort((a, b) => b - a),
    availableCount: units.filter((unit) => unit.status === 'available').length };
}
