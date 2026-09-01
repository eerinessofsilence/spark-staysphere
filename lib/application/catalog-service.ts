import type { BookingEngineAdapter, HotelRepository } from '../domain/ports';
import { buildPriceBreakdown, nightsBetween } from '../domain/pricing';
import { roomCategory, type RoomCategory } from '../domain/room-attributes';
import type { AddOn, Hotel, Quote, RoomOffer, RoomType, StayCriteria } from '../domain/schemas';

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

export class CatalogService {
  constructor(
    private readonly repository: HotelRepository,
    private readonly bookingEngine: BookingEngineAdapter,
  ) {}

  async getHotel(slug: string): Promise<Hotel> {
    const hotel = await this.repository.getHotel(slug);
    if (!hotel) throw new HotelNotFoundError(slug);
    return hotel;
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
    const rooms = await this.repository.listRooms(hotel.id);
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
    const room = rooms.find((candidate) => candidate.slug === roomSlug);
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
