import type {
  AddOn,
  Booking,
  Currency,
  Hotel,
  PaymentAttempt,
  PriceBreakdown,
  Quote,
  RatePlan,
  RoomOffer,
  RoomType,
  StayCriteria,
} from '../domain/schemas';
import type { RoomCategory } from '../domain/room-attributes';
import type { Facade } from '../domain/room-units';
import type { SpinnerPolygon } from '../domain/spinner-markup';

/** DTOs exchanged over the PMS HTTP boundary; Guest owns no hotel data services. */
export type BookingErrorCode = 'invalid_request' | 'unavailable' | 'price_changed' | 'payment_declined' | 'not_found' | 'request_failed';

export interface BookingConfirmation {
  booking: Booking;
  room: RoomType | null;
  ratePlan: RatePlan | null;
  addOns: AddOn[];
  payments: PaymentAttempt[];
}

export interface TripSummary {
  reference: string;
  roomName: string;
  roomSlug: string | null;
  photo: { url: string; width?: number; height?: number } | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  addOnCount: number;
  total: number;
  currency: Currency;
  status: Booking['status'];
  canCancel: boolean;
  createdAt: string;
}

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
  totalRooms: number;
  availableRooms: number;
  facets: CatalogFacets;
}

export interface RoomDetail {
  hotel: Hotel;
  offer: RoomOffer;
  addOns: AddOn[];
  quote: Quote;
}

export interface DiningMenu {
  hotel: Hotel;
  items: AddOn[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  from: 'guest' | 'hotel' | 'system';
  author: string;
  body: string;
  sentAt: string;
  deliveryStatus?: 'accepted' | 'demo_only' | 'failed';
}

export interface GuestConversation {
  conversationId: string;
  messages: ChatMessage[];
}

export type GuestSpinnerZone = { id: string; frameIndex: number; polygon: SpinnerPolygon } & (
  | { kind: 'unit'; roomSlug: string; unitNumber: string; floor: number; href: string }
  | { kind: 'roomType'; roomSlug: string; href: string }
  | { kind: 'floor'; floor: number; facade: 'sea' | 'town' | null; roomNames: string[]; href: string }
  | { kind: 'link'; label: string; description: string; cta: string; href: string }
);

export type FloorPlanStatus = 'available' | 'booked' | 'unsuitable' | 'filtered';

export interface FloorPlanUnit {
  number: string;
  floor: number;
  facade: Facade;
  roomTypeId: string;
  roomSlug: string;
  roomName: string;
  category: RoomCategory;
  areaM2: number;
  capacity: number;
  view: RoomType['view'];
  bedType: RoomType['bedType'];
  status: FloorPlanStatus;
  price: PriceBreakdown | null;
}

export interface FloorPlan {
  hotel: Hotel;
  criteria: StayCriteria;
  floors: number[];
  units: FloorPlanUnit[];
  availableCount: number;
}

export interface AssistantAskResult {
  criteria: StayCriteria;
  filters: RoomFilters;
  offers: RoomOffer[];
  totalRooms: number;
  availableRooms: number;
  unresolved: string[];
  query: string;
  relaxation: { label: string; filters: RoomFilters; query: string } | null;
  usedInterpreter: boolean;
}
