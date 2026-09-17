import type {
  AddOn,
  Availability,
  Booking,
  Guest,
  Hotel,
  IntegrationStatus,
  PaymentAttempt,
  PhysicalRoom,
  Quote,
  RatePlan,
  RoomStatus,
  RoomType,
  StayCriteria,
} from './schemas';
import type { SpinnerZone, SpinnerZoneUpsert } from './spinner-markup';
// Type-only: `RoomFilters`/`CatalogFacets` are application-layer shapes, but
// the assistant's contract is stated in terms of them rather than a second,
// domain-owned copy. A type import has no runtime edge, so this does not
// give `lib/domain` a dependency on `lib/application` the way an implementation
// import would.
import type { CatalogFacets, RoomFilters } from '../application/catalog-service';

/**
 * `HotelRepository` below is still the full read/write surface every backend
 * (in-memory, D1, the durable overlay wrapper) implements in one object —
 * splitting *that* would mean juggling four separate bindings for what is
 * really one durable store. What was worth splitting is the *dependency*: a
 * service constructor can declare just the slice it actually calls, instead
 * of `HotelRepository` in full, so a narrower catalog-only service (
 * `CatalogService`) can't accidentally reach for `saveBooking`, and the
 * constructor signature itself documents what the service touches. Every
 * concrete repository still satisfies all four structurally, so nothing here
 * changes what's passed to `new CatalogService(...)` etc. in container.ts —
 * only the declared parameter type each one asks for.
 */
export interface CatalogReader {
  getHotel(slug: string): Promise<Hotel | null>;
  listRooms(hotelId: string): Promise<RoomType[]>;
  /** Every door in the building, hidden room types' included. `getAvailability` counts these. */
  listPhysicalRooms(hotelId: string): Promise<PhysicalRoom[]>;
  listRatePlans(roomTypeId: string): Promise<RatePlan[]>;
  listAddOns(hotelId: string): Promise<AddOn[]>;
}

export interface AvailabilityReader {
  getAvailability(roomTypeId: string, from: string, to: string): Promise<Availability[]>;
}

export interface BookingStore {
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
}

export interface PaymentAttemptStore {
  savePaymentAttempt(attempt: PaymentAttempt): Promise<PaymentAttempt>;
  listPaymentAttempts(bookingId: string): Promise<PaymentAttempt[]>;
}

export interface HotelRepository
  extends CatalogReader,
    AvailabilityReader,
    BookingStore,
    PaymentAttemptStore {}

/**
 * Demo-only inventory controls backing `/admin`. Production replaces this with
 * PMS write-through; the guest-facing code never depends on it.
 */
/**
 * An add-on's `enabled` flag used to live in its own DemoControlPort method
 * backed by a separate table; it is now just a field on the add-on entity,
 * written through `CatalogContentPort` by `content-service.ts` — the same
 * path whether it's flipped from `/admin`'s quick switch or from the CMS.
 */
export interface DemoControlPort {
  setRoomStatusOverride(roomTypeId: string, status: RoomStatus | null): Promise<void>;
  getRoomStatusOverride(roomTypeId: string): Promise<RoomStatus | null>;
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

/** One file the media picker can offer, read from the generated manifest. */
export interface MediaAsset {
  url: string;
  folder: string;
  filename: string;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Not implemented in v1 — `.openai/hosting.json` has `r2: null`, and the CMS
 * only ever picks from `public/images/**` (see `lib/infrastructure/media-library.ts`).
 * Declared now so the day R2 is configured, an adapter implementing this is
 * the only new infrastructure content-service needs; the picker UI and the
 * "url must be in the media library" rule do not change shape.
 */
export interface MediaStoragePort {
  upload(input: { filename: string; contentType: string; bytes: ArrayBuffer }): Promise<MediaAsset>;
  delete(url: string): Promise<void>;
}

/** The read-only vocabulary the CMS media picker and its validation draw from. */
export interface MediaLibraryPort {
  list(): MediaAsset[];
  find(url: string): MediaAsset | undefined;
}

/** The kinds of catalog entity the CMS can overlay onto seed data. `room` is a room type; `unit` is one physical room. */
export type CatalogEntryKind = 'hotel' | 'room' | 'unit' | 'rate' | 'addon';

/**
 * One overlay row: a full entity that either replaces a seed entity of the
 * same `kind`/`id`, or — for an id the seed never had — is a wholly new one.
 * `version` starts at `0` for an entity that has never been overlaid (the
 * seed itself), so a first edit can still be submitted with an
 * `expectedVersion` and be caught by a concurrent first edit.
 */
export interface CatalogEntryRecord<T = unknown> {
  kind: CatalogEntryKind;
  id: string;
  hotelId: string;
  data: T;
  version: number;
  updatedAt: string;
}

export type CatalogUpsertResult =
  | { ok: true; version: number }
  | { ok: false; conflict: true; currentVersion: number };

export type CatalogDeleteResult = { ok: true } | { ok: false; conflict: true; currentVersion: number };

/**
 * The CMS's storage boundary. Seed data (`lib/infrastructure/mock-data.ts`)
 * is never mutated — this port only ever holds overlay rows, one per
 * `(kind, id)`, and `reset()` clears them so the catalog falls back to seed.
 * `lib/application/content-service.ts` is the only caller: it owns the
 * business rules (slugs, references, currency, media, concurrency), this
 * port just persists what it decides. Wired only in `container.ts`.
 */
export interface CatalogContentPort {
  getEntry(kind: CatalogEntryKind, id: string): Promise<CatalogEntryRecord | null>;
  /** Every overlay row of one kind for the hotel — includes hidden rooms. */
  listEntries(kind: CatalogEntryKind, hotelId: string): Promise<CatalogEntryRecord[]>;
  /**
   * Replaces the row, but only if `expectedVersion` matches what is stored
   * (or the row does not exist yet and `expectedVersion` is `0`). A mismatch
   * returns `{ ok: false, conflict: true, currentVersion }` and writes nothing.
   */
  upsertEntry(input: {
    kind: CatalogEntryKind;
    id: string;
    hotelId: string;
    data: unknown;
    expectedVersion: number;
  }): Promise<CatalogUpsertResult>;
  /**
   * Removes the overlay row only — never the seed entity underneath it.
   * Guarded by `expectedVersion` the same way `upsertEntry` is: a mismatch
   * returns `{ ok: false, conflict: true, currentVersion }` and deletes
   * nothing.
   */
  deleteEntry(kind: CatalogEntryKind, id: string, expectedVersion: number): Promise<CatalogDeleteResult>;
  /** Clears every overlay row for the hotel; the catalog reverts to seed. */
  reset(hotelId: string): Promise<void>;
}

/**
 * Storage for the zones drawn in `/admin/content/spinner` — see
 * `lib/domain/spinner-markup.ts` for what a zone is and why it isn't a
 * `CatalogContentPort` overlay row. No optimistic concurrency here: a zone
 * is one polygon a hotel team draws from scratch (there's no seed value to
 * conflict with), and `applyZoneBatch` — like the reference editor's own
 * `saveBatch` — is a plain scoped upsert/delete, guarded only by `hotelId`
 * so one hotel's batch can never touch another's rows.
 */
export interface SpinnerMarkupPort {
  listZones(hotelId: string): Promise<SpinnerZone[]>;
  applyZoneBatch(hotelId: string, batch: { upserts: SpinnerZoneUpsert[]; deletes: string[] }): Promise<void>;
  /** Clears every zone for the hotel — paired with `ContentService.resetContent()`. */
  reset(hotelId: string): Promise<void>;
}

/**
 * The current instant, behind an interface so a service that needs "now" —
 * `BookingService`'s cancellation eligibility, `ContentService`'s "upcoming"
 * filters — can be tested against a fixed date instead of the real clock.
 * `systemClock` (`lib/domain/clock.ts`) is the only implementation actually
 * wired (see each service's constructor default); nothing here changes what
 * "today" is computed as, only where the `Date` it starts from comes from.
 */
export interface Clock {
  now(): Date;
}
