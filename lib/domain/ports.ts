import type {
  AddOn,
  Availability,
  Booking,
  Guest,
  Hotel,
  IntegrationStatus,
  PaymentAttempt,
  Quote,
  RatePlan,
  RoomStatus,
  RoomType,
  StayCriteria,
} from './schemas';
// Type-only: `RoomFilters`/`CatalogFacets` are application-layer shapes, but
// the assistant's contract is stated in terms of them rather than a second,
// domain-owned copy. A type import has no runtime edge, so this does not
// give `lib/domain` a dependency on `lib/application` the way an implementation
// import would.
import type { CatalogFacets, RoomFilters } from '../application/catalog-service';

export interface HotelRepository {
  getHotel(slug: string): Promise<Hotel | null>;
  listRooms(hotelId: string): Promise<RoomType[]>;
  listRatePlans(roomTypeId: string): Promise<RatePlan[]>;
  listAddOns(hotelId: string): Promise<AddOn[]>;
  getAvailability(roomTypeId: string, from: string, to: string): Promise<Availability[]>;
  findBookingByIdempotencyKey(key: string): Promise<Booking | null>;
  saveBooking(booking: Booking): Promise<Booking>;
  getBookingByReference(reference: string): Promise<Booking | null>;
  /**
   * Marks a booking cancelled and gives back the nights it was holding, so
   * the room returns to sale. Idempotent: a booking already cancelled is
   * returned unchanged and its inventory is not credited twice.
   */
  cancelBooking(reference: string): Promise<Booking | null>;
  listBookings(): Promise<Booking[]>;
  savePaymentAttempt(attempt: PaymentAttempt): Promise<PaymentAttempt>;
  listPaymentAttempts(bookingId: string): Promise<PaymentAttempt[]>;
}

/**
 * Demo-only inventory controls backing `/admin`. Production replaces this with
 * PMS write-through; the guest-facing code never depends on it.
 */
export interface DemoControlPort {
  setRoomStatusOverride(roomTypeId: string, status: RoomStatus | null): Promise<void>;
  getRoomStatusOverride(roomTypeId: string): Promise<RoomStatus | null>;
  setAddOnEnabled(addOnId: string, enabled: boolean): Promise<void>;
  listIntegrationStatuses(): Promise<IntegrationStatus[]>;
  reset(): Promise<void>;
}

export interface PmsAdapter {
  pullInventory(hotelId: string): Promise<void>;
  pushReservation(booking: Booking): Promise<{ externalId: string }>;
}

export interface ChannelManagerAdapter {
  syncRatesAndAvailability(hotelId: string): Promise<void>;
}

export interface QuoteRequest {
  roomTypeId: string;
  ratePlanId?: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  addOnIds: string[];
}

export interface BookingEngineAdapter {
  /** Authoritative price and availability for a stay, including selected add-ons. */
  quote(input: QuoteRequest): Promise<Quote>;
  hold(input: { roomTypeId: string; checkIn: string; checkOut: string }): Promise<{ holdId: string; expiresAt: string }>;
}

export interface PaymentProvider {
  authorizeDemo(input: { bookingId: string; amount: number; currency: string }): Promise<{ paymentAttemptId: string; authorized: boolean; declineReason?: string }>;
}

export interface CrmAdapter {
  upsertGuest(guest: Guest): Promise<{ contactId: string }>;
  trackBooking(booking: Booking): Promise<void>;
}

/**
 * What the assistant understood from an utterance — a filter object, never a
 * fact about a room. `criteria`/`filters` are partial because an utterance
 * that only mentions a view says nothing about dates, and the service merges
 * this onto the guest's existing stay rather than replacing it wholesale.
 */
export interface SearchIntent {
  criteria: Partial<StayCriteria>;
  filters: Partial<RoomFilters>;
  addOnIds: string[];
  /** Phrases the interpreter understood but the catalog cannot express. */
  unresolved: string[];
}

export interface RoomSearchInterpreter {
  interpret(input: {
    utterance: string;
    today: string; // ISO, so "next weekend" resolves server-side
    current: StayCriteria; // what the guest already has in the URL
    facets: CatalogFacets; // the only amenity/category vocabulary allowed
  }): Promise<SearchIntent>;
}

export interface SpeechTranscriber {
  transcribe(input: {
    audio: Blob | ArrayBuffer;
    mimeType: string;
    language?: string;
  }): Promise<{ text: string }>;
}
