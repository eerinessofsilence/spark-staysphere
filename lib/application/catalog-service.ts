import type { AvailabilityReader, BookingEngineAdapter, CatalogReader, SpinnerMarkupPort } from '../domain/ports';
import { buildPriceBreakdown, nightsBetween } from '../domain/pricing';
import { facadeOf } from '../domain/room-units';
import { roomCategory, type RoomCategory } from '../domain/room-attributes';
import type { AddOn, Hotel, PhysicalRoom, Quote, RoomOffer, RoomType, StayCriteria } from '../domain/schemas';
import type { SpinnerPolygon, SpinnerZone } from '../domain/spinner-markup';

export type SortOrder = 'recommended' | 'price_asc' | 'price_desc' | 'area_desc';

export interface RoomFilters {
  minPrice: number | null;
  maxPrice: number | null;
  views: RoomType['view'][];
  bedTypes: RoomType['bedType'][];
  categories: RoomCategory[];
  amenities: string[];
  minArea: number | null;
  minFloor: number | null;
  includeSoldOut: boolean;
  sort: SortOrder;
}

export const defaultRoomFilters: RoomFilters = {
  minPrice: null,
  maxPrice: null,
  views: [],
  bedTypes: [],
  categories: [],
  amenities: [],
  minArea: null,
  minFloor: null,
  includeSoldOut: true,
  sort: 'recommended',
};

export interface CatalogFacets {
  amenities: string[];
  categories: RoomCategory[];
  views: RoomType['view'][];
  bedTypes: RoomType['bedType'][];
  priceRange: { min: number; max: number };
  areaRange: { min: number; max: number };
  maxFloor: number;
}

export interface SearchResult {
  hotel: Hotel;
  criteria: StayCriteria;
  offers: RoomOffer[];
  /** Offers before filters, so the UI can say "6 of 8 rooms". */
  totalRooms: number;
  availableRooms: number;
  facets: CatalogFacets;
}

export interface RoomDetail {
  hotel: Hotel;
  offer: RoomOffer;
  addOns: AddOn[];
  /** Priced with the currently selected add-ons. */
  quote: Quote;
}

const viewWeight: Record<RoomType['view'], number> = { sea: 12, pool: 9, garden: 6, city: 4 };

export class HotelNotFoundError extends Error {
  constructor(slug: string) {
    super(`No hotel is published at "${slug}".`);
    this.name = 'HotelNotFoundError';
  }
}

export class RoomNotFoundError extends Error {
  constructor(slug: string) {
    super(`No room type is published at "${slug}".`);
    this.name = 'RoomNotFoundError';
  }
}

/**
 * A spinner-markup zone (`lib/domain/spinner-markup.ts`) resolved for a
 * guest: its target's catalog reference is followed and turned into
 * whatever the overlay needs to render and link to. A zone whose target no
 * longer resolves — a deleted unit, a hidden or deleted room type — is
 * dropped entirely rather than shown broken; see `getSpinnerZones`.
 */
export type GuestSpinnerZone = { id: string; frameIndex: number; polygon: SpinnerPolygon } & (
  | { kind: 'unit'; roomSlug: string; unitNumber: string; floor: number; href: string }
  | { kind: 'roomType'; roomSlug: string; href: string }
  | { kind: 'floor'; floor: number; facade: 'sea' | 'town' | null; roomNames: string[]; href: string }
  | { kind: 'link'; label: string; description: string; cta: string; href: string }
);

export class CatalogService {
  constructor(
    private readonly repository: CatalogReader & AvailabilityReader,
    private readonly bookingEngine: BookingEngineAdapter,
    private readonly spinnerMarkup?: SpinnerMarkupPort,
  ) {}

  /**
   * The guest-facing hotel: hotspots, floor zones, and spinner markers that
   * point at a room the CMS has hidden are stripped, so a guest can never
   * land on a withdrawn room from the arrival scene or the 3D model. CMS
   * pages read the same entity through `hotelRepository.getHotel` directly
   * instead, unfiltered, since a hotel team needs to see and edit every
   * hotspot whether or not the room behind it is currently on sale.
   */
  async getHotel(slug: string): Promise<Hotel> {
    const hotel = await this.repository.getHotel(slug);
    if (!hotel) throw new HotelNotFoundError(slug);

    const rooms = await this.repository.listRooms(hotel.id);
    const hiddenSlugs = new Set(rooms.filter((room) => room.hidden).map((room) => room.slug));
    if (hiddenSlugs.size === 0) return hotel;

    return {
      ...hotel,
      areas: hotel.areas.map((area) => ({
        ...area,
        hotspots: area.hotspots.filter((hotspot) => !hotspot.roomSlug || !hiddenSlugs.has(hotspot.roomSlug)),
        roomZones: area.roomZones?.filter((zone) => !hiddenSlugs.has(zone.roomSlug)),
      })),
      spinner: hotel.spinner
        ? {
            ...hotel.spinner,
            hotspots: hotel.spinner.hotspots.filter(
              (hotspot) => !hotspot.roomSlug || !hiddenSlugs.has(hotspot.roomSlug),
            ),
          }
        : hotel.spinner,
    };
  }

  /**
   * The zones drawn in `/admin/content/spinner`, resolved for a guest: each
   * target is followed through the current catalog (never the CMS's raw
   * `spinnerMarkup.listZones`, the same way `getHotel` never hands back raw
   * seed hotspots) so a hidden room type, a deleted unit, or a zone nobody
   * has bound yet never reaches the spinner. Independent of `Hotel.spinner`
   * — see `lib/domain/spinner-markup.ts`.
   */
  async getSpinnerZones(slug: string): Promise<GuestSpinnerZone[]> {
    if (!this.spinnerMarkup) return [];
    const hotel = await this.repository.getHotel(slug);
    if (!hotel) throw new HotelNotFoundError(slug);

    const [zones, rooms, units] = await Promise.all([
      this.spinnerMarkup.listZones(hotel.id),
      this.repository.listRooms(hotel.id),
      this.repository.listPhysicalRooms(hotel.id),
    ]);
    const roomById = new Map(rooms.map((room) => [room.id, room]));
    const unitById = new Map(units.map((unit) => [unit.id, unit]));

    const resolved: GuestSpinnerZone[] = [];
    for (const zone of zones) {
      const guest = this.resolveZoneTarget(zone, roomById, unitById);
      if (guest) resolved.push(guest);
    }
    return resolved;
  }

  private resolveZoneTarget(
    zone: SpinnerZone,
    roomById: Map<string, RoomType>,
    unitById: Map<string, PhysicalRoom>,
  ): GuestSpinnerZone | null {
    const base = { id: zone.id, frameIndex: zone.frameIndex, polygon: zone.polygon };
    if (!zone.target) return null;

    switch (zone.target.kind) {
      case 'unit': {
        const unit = unitById.get(zone.target.unitId);
        const room = unit ? roomById.get(unit.roomTypeId) : undefined;
        if (!unit || !room || room.hidden) return null;
        return { ...base, kind: 'unit', roomSlug: room.slug, unitNumber: unit.number, floor: unit.floor, href: `/rooms/${room.slug}` };
      }
      case 'roomType': {
        const room = roomById.get(zone.target.roomTypeId);
        if (!room || room.hidden) return null;
        return { ...base, kind: 'roomType', roomSlug: room.slug, href: `/rooms/${room.slug}` };
      }
      case 'floor':
        return this.resolveFloorZone(base, zone.target, roomById);
      case 'link':
        return { ...base, kind: 'link', label: zone.target.label, description: zone.target.description, cta: zone.target.cta, href: zone.target.href };
      default:
        return null;
    }
  }

  private resolveFloorZone(
    base: { id: string; frameIndex: number; polygon: SpinnerPolygon },
    target: Extract<SpinnerZone['target'], { kind: 'floor' }>,
    roomById: Map<string, RoomType>,
  ): GuestSpinnerZone | null {
    const onFloor = [...roomById.values()].filter(
      (room) => !room.hidden && room.floor === target.floor && (!target.facade || facadeOf(room.view) === target.facade),
    );
    if (onFloor.length === 0) return null;
    const href = `/rooms?minFloor=${target.floor}${target.facade === 'sea' ? '&view=sea&view=pool' : target.facade === 'town' ? '&view=garden&view=city' : ''}&layout=plan`;
    return { ...base, kind: 'floor', floor: target.floor, facade: target.facade, roomNames: onFloor.map((room) => room.name), href };
  }

  async listAddOns(hotelId: string): Promise<AddOn[]> {
    return this.repository.listAddOns(hotelId);
  }

  /** Prices and inventory for one room over one stay. Add-ons are excluded here. */
  private async buildOffer(room: RoomType, criteria: StayCriteria): Promise<RoomOffer | null> {
    const [ratePlan] = await this.repository.listRatePlans(room.id);
    if (!ratePlan) return null;

    const nights = nightsBetween(criteria.checkIn, criteria.checkOut);
    const availability = await this.repository.getAvailability(
      room.id,
      criteria.checkIn,
      criteria.checkOut,
    );
    const remaining = availability.length
      ? Math.min(...availability.map((night) => night.remaining))
      : 0;

    return {
      room,
      ratePlan,
      remaining,
      status: statusFor(remaining),
      price: buildPriceBreakdown({
        ratePlan,
        addOns: [],
        nights,
        adults: criteria.adults,
        children: criteria.children,
      }),
    };
  }

  async search(
    hotelSlug: string,
    criteria: StayCriteria,
    filters: RoomFilters,
  ): Promise<SearchResult> {
    const hotel = await this.getHotel(hotelSlug);
    const rooms = (await this.repository.listRooms(hotel.id)).filter((room) => !room.hidden);
    const guests = criteria.adults + criteria.children;

    const built = await Promise.all(rooms.map((room) => this.buildOffer(room, criteria)));
    const allOffers = built.filter((offer): offer is RoomOffer => offer !== null);

    const offers = allOffers
      .filter((offer) => offer.room.capacity >= guests)
      .filter((offer) => matchesFilters(offer, filters))
      .sort(comparatorFor(filters.sort, guests));

    return {
      hotel,
      criteria,
      offers,
      totalRooms: allOffers.length,
      availableRooms: allOffers.filter((offer) => offer.status !== 'sold_out').length,
      facets: buildFacets(allOffers),
    };
  }

  /** Room detail, priced live against the booking engine with the chosen add-ons. */
  async getRoomDetail(
    hotelSlug: string,
    roomSlug: string,
    criteria: StayCriteria,
    addOnIds: string[],
  ): Promise<RoomDetail> {
    const hotel = await this.getHotel(hotelSlug);
    const rooms = await this.repository.listRooms(hotel.id);
    const room = rooms.find((candidate) => candidate.slug === roomSlug && !candidate.hidden);
    if (!room) throw new RoomNotFoundError(roomSlug);

    const offer = await this.buildOffer(room, criteria);
    if (!offer) throw new RoomNotFoundError(roomSlug);

    const addOns = await this.repository.listAddOns(hotel.id);
    const enabledIds = new Set(addOns.filter((addOn) => addOn.enabled).map((addOn) => addOn.id));

    const quote = await this.bookingEngine.quote({
      roomTypeId: room.id,
      ratePlanId: offer.ratePlan.id,
      checkIn: criteria.checkIn,
      checkOut: criteria.checkOut,
      adults: criteria.adults,
      children: criteria.children,
      addOnIds: addOnIds.filter((id) => enabledIds.has(id)),
    });

    return { hotel, offer, addOns, quote };
  }
}

function statusFor(remaining: number): RoomOffer['status'] {
  if (remaining <= 0) return 'sold_out';
  if (remaining === 1) return 'last_room';
  if (remaining <= 3) return 'limited';
  return 'available';
}

function matchesFilters(offer: RoomOffer, filters: RoomFilters): boolean {
  const { room, ratePlan, status } = offer;
  if (!filters.includeSoldOut && status === 'sold_out') return false;
  if (filters.minPrice !== null && ratePlan.nightlyPrice < filters.minPrice) return false;
  if (filters.maxPrice !== null && ratePlan.nightlyPrice > filters.maxPrice) return false;
  if (filters.views.length && !filters.views.includes(room.view)) return false;
  if (filters.bedTypes.length && !filters.bedTypes.includes(room.bedType)) return false;
  if (filters.categories.length && !filters.categories.includes(roomCategory(room))) return false;
  if (filters.minArea !== null && room.areaM2 < filters.minArea) return false;
  if (filters.minFloor !== null && room.floor < filters.minFloor) return false;
  if (filters.amenities.length && !filters.amenities.every((a) => room.amenities.includes(a))) {
    return false;
  }
  return true;
}

function recommendationScore(offer: RoomOffer, guests: number): number {
  const sellable = offer.status === 'sold_out' ? 0 : 100;
  const fit = offer.room.capacity === guests ? 8 : 0;
  return sellable + viewWeight[offer.room.view] + fit + offer.room.areaM2 / 20;
}

function comparatorFor(sort: SortOrder, guests: number) {
  return (a: RoomOffer, b: RoomOffer): number => {
    // Sold-out rooms always sink, whichever sort is active.
    const sellable = Number(b.status !== 'sold_out') - Number(a.status !== 'sold_out');
    if (sellable !== 0) return sellable;

    switch (sort) {
      case 'price_asc':
        return a.ratePlan.nightlyPrice - b.ratePlan.nightlyPrice;
      case 'price_desc':
        return b.ratePlan.nightlyPrice - a.ratePlan.nightlyPrice;
      case 'area_desc':
        return b.room.areaM2 - a.room.areaM2;
      case 'recommended':
        return recommendationScore(b, guests) - recommendationScore(a, guests);
    }
  };
}

function buildFacets(offers: RoomOffer[]): CatalogFacets {
  const amenities = new Set<string>();
  const categories = new Set<RoomCategory>();
  const views = new Set<RoomType['view']>();
  const bedTypes = new Set<RoomType['bedType']>();
  const prices: number[] = [];
  const areas: number[] = [];
  let maxFloor = 0;

  for (const offer of offers) {
    offer.room.amenities.forEach((amenity) => amenities.add(amenity));
    categories.add(roomCategory(offer.room));
    views.add(offer.room.view);
    bedTypes.add(offer.room.bedType);
    prices.push(offer.ratePlan.nightlyPrice);
    areas.push(offer.room.areaM2);
    maxFloor = Math.max(maxFloor, offer.room.floor);
  }

  return {
    amenities: [...amenities].sort((a, b) => a.localeCompare(b)),
    categories: [...categories],
    views: [...views],
    bedTypes: [...bedTypes],
    priceRange: {
      min: prices.length ? Math.floor(Math.min(...prices)) : 0,
      max: prices.length ? Math.ceil(Math.max(...prices)) : 0,
    },
    areaRange: {
      min: areas.length ? Math.floor(Math.min(...areas)) : 0,
      max: areas.length ? Math.ceil(Math.max(...areas)) : 0,
    },
    maxFloor,
  };
}
