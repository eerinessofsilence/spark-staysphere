import type {
  AddOn,
  Availability,
  Booking,
  BookingGuest,
  BookingRoomAssignment,
  BookingGroup,
  Currency,
  GuestProfile,
  Guest,
  Hotel,
  HousekeepingStatus,
  IntegrationStatus,
  PaymentAttempt,
  PhysicalRoom,
  Quote,
  RatePlan,
  RoomStatus,
  StayState,
  TeamRoleDefinition,
  RoomType,
  StayCriteria,
} from './schemas';
import type { SpinnerZone, SpinnerZoneUpsert } from './spinner-markup';
import type { StoredTeamMember } from './team-member';
import type { HotelOrder, OrderStatus } from './orders';
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
  /** Saves a confirmed booking, its inventory and its first payment in one transaction. */
  saveBooking(booking: Booking, inventoryCapacity?: number, initialPayment?: PaymentAttempt): Promise<Booking>;
  getBookingByReference(reference: string): Promise<Booking | null>;
  /**
   * Marks a booking cancelled and gives back the nights it was holding, so
   * the room returns to sale. Idempotent: a booking already cancelled is
   * returned unchanged and its inventory is not credited twice.
   */
  cancelBooking(reference: string, reason?: string): Promise<Booking | null>;
  /** The desk's check-in / check-out / no-show mark. Inventory is untouched: the booking itself stays as it is. */
  setBookingStayState(reference: string, state: StayState): Promise<Booking | null>;
  /** Replaces the room itinerary for a reservation while keeping its booking id and folio. */
  saveBookingRoomAssignments(bookingId: string, assignments: BookingRoomAssignment[]): Promise<boolean>;
  /** Atomically move the remaining nights to another room type and update the quoted booking total. */
  transferBookingRoomType(input: {
    bookingId: string;
    expectedRoomTypeId: string;
    expectedTotal: number;
    sourceRoomTypeId: string;
    sourceRoomNumber: string;
    targetRoomTypeId: string;
    targetRatePlanId: string;
    targetRoomNumber: string;
    newTotal: number;
    capacity: number;
    fromDate: string;
    checkOut: string;
    oldNightsByType: Record<string, string[]>;
    assignments: BookingRoomAssignment[];
  }): Promise<boolean>;
  /** Atomically change a confirmed stay's dates, price and inventory holds. */
  changeBookingStayDates(input: {
    bookingId: string;
    expectedCheckIn: string;
    expectedCheckOut: string;
    expectedTotal: number;
    roomTypeId: string;
    roomNumber: string;
    newCheckIn: string;
    newCheckOut: string;
    newTotal: number;
    capacity: number;
    addedNights: string[];
    releasedNights: string[];
    assignments: BookingRoomAssignment[];
  }): Promise<boolean>;
  /** Save hotel-local arrival/departure times with an optimistic concurrency check. */
  changeBookingStayTimes(input: {
    bookingId: string;
    expectedCheckIn: string;
    expectedCheckOut: string;
    expectedCheckInTime: string;
    expectedCheckOutTime: string;
    expectedLateCheckIn: boolean;
    expectedLateCheckOut: boolean;
    checkInTime: string;
    checkOutTime: string;
    lateCheckIn: boolean;
    lateCheckOut: boolean;
  }): Promise<boolean>;
  listBookings(options?: { hotelId?: string; limit?: number }): Promise<Booking[]>;
}

/** Names the occupants already included in a booking's adult/child totals. */
export interface BookingGuestStore {
  listBookingGuests(bookingId: string): Promise<BookingGuest[]>;
  /** Atomically refuses another name once that category's booked places are filled. */
  addBookingGuest(guest: BookingGuest, hotelId: string): Promise<boolean>;
}

export interface PaymentAttemptStore {
  savePaymentAttempt(attempt: PaymentAttempt): Promise<PaymentAttempt>;
  /** Atomically records a refund only if the authorized, same-currency balance covers it. */
  saveRefundWithinBalance(attempt: PaymentAttempt): Promise<boolean>;
  listPaymentAttempts(bookingId: string): Promise<PaymentAttempt[]>;
}

/** Hotel services/orders shown on the operational Orders grid. */
export interface OrderStore {
  listOrders(hotelId: string): Promise<HotelOrder[]>;
  createOrder(order: HotelOrder): Promise<HotelOrder>;
  /** Atomically require the stored status to be new; otherwise throw ORDER_NOT_EDITABLE. */
  updateOrder(order: HotelOrder): Promise<HotelOrder | null>;
  setOrderStatus(hotelId: string, orderId: string, status: OrderStatus): Promise<HotelOrder | null>;
}

/**
 * `/admin/groups` — a shared reservation the desk names, then attaches
 * existing bookings to (`assignBookingToGroup`). There is no group-level
 * rate or inventory; everything else about a group (its balance, its own
 * bookings list) is derived by filtering `listBookings()` on `groupId`, the
 * same rule `lib/application/guest-directory.ts` already applies to a guest.
 */
export interface BookingGroupStore {
  createBookingGroup(group: BookingGroup): Promise<BookingGroup>;
  listBookingGroups(hotelId: string): Promise<BookingGroup[]>;
  getBookingGroup(id: string): Promise<BookingGroup | null>;
  /** No-ops when the booking or group doesn't exist; returns the updated booking either way it could apply. */
  assignBookingToGroup(bookingId: string, groupId: string): Promise<Booking | null>;
  removeBookingFromGroup(bookingId: string): Promise<Booking | null>;
  /** Un-assigns every member booking first — a group is a label, deleting it never deletes a booking. */
  deleteBookingGroup(id: string): Promise<void>;
}

/**
 * A guest created directly on `/admin/guests`, before or without any
 * booking. `lib/application/guest-directory.ts` merges these with the
 * guests derived from `listBookings()`, by email.
 */
export interface GuestProfileStore {
  createGuestProfile(profile: GuestProfile): Promise<GuestProfile>;
  deleteGuestProfile(profileId: string, hotelId: string): Promise<void>;
  anonymizeGuestBookings(hotelId: string, email: string): Promise<number>;
  saveGuestIdentity(profileId: string, hotelId: string, identity: NonNullable<GuestProfile['identity']>): Promise<void>;
  listGuestProfiles(hotelId: string): Promise<GuestProfile[]>;
}

export interface HotelRepository
  extends CatalogReader,
    AvailabilityReader,
    BookingStore,
    BookingGuestStore,
    PaymentAttemptStore,
    BookingGroupStore,
    GuestProfileStore {}

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

/**
 * The durable half of `/admin/settings/team`'s roles: custom role
 * definitions, edits that override a built-in role's seeded definition, and
 * which member has been moved onto another role by id.
 */
export interface RoleStore {
  listMembers(): Promise<StoredTeamMember[]>;
  /** Atomically reject an existing email, including concurrent submissions. */
  createMember(member: StoredTeamMember): Promise<boolean>;
  listMemberHotelIds(memberId: string): Promise<string[]>;
  hasMemberHotelScope(memberId: string): Promise<boolean>;
  setMemberHotelIds(memberId: string, hotelIds: string[]): Promise<void>;
  listRoleDefinitions(): Promise<TeamRoleDefinition[]>;
  createRoleDefinition(role: TeamRoleDefinition): Promise<TeamRoleDefinition>;
  upsertRoleDefinition(role: TeamRoleDefinition): Promise<TeamRoleDefinition>;
  deleteRoleDefinition(id: string): Promise<void>;
  countMemberRoleOverrides(roleId: string): Promise<number>;
  getMemberRoleOverride(memberId: string): Promise<string | null>;
  setMemberRoleOverride(memberId: string, roleId: string): Promise<void>;
}

/** One physical room's housekeeping status as someone last set it — a room with no record has never been touched. */
export interface HousekeepingRecord {
  unitId: string;
  hotelId: string;
  status: HousekeepingStatus;
  /** What the attendant left for the desk — "lamp broken", "late check-out" — or nothing. */
  note: string | null;
  updatedAt: string;
}

export interface HousekeepingAssignment {
  hotelId: string;
  unitId: string;
  memberId: string;
}

export interface HousekeepingEvent {
  id: string;
  hotelId: string;
  unitId: string;
  roomNumber: string;
  memberId: string;
  status: HousekeepingStatus;
  note: string | null;
  occurredAt: string;
  photoData: string | null;
}

/**
 * The durable half of `/admin/housekeeping`: only rooms someone has marked
 * are stored, keyed by the physical room's id, so the seed rooms and rooms
 * added later in the CMS are treated alike (see `HousekeepingService`).
 */
export interface HousekeepingStore {
  listRecords(hotelId: string): Promise<HousekeepingRecord[]>;
  setRecord(record: HousekeepingRecord): Promise<void>;
  listAssignments(hotelId: string): Promise<HousekeepingAssignment[]>;
  setAssignment(assignment: HousekeepingAssignment | { hotelId: string; unitId: string; memberId: null }): Promise<void>;
  saveChange(record: HousekeepingRecord, event: HousekeepingEvent): Promise<void>;
  listEvents(hotelId: string, unitId: string): Promise<HousekeepingEvent[]>;
  getEvent(hotelId: string, id: string): Promise<HousekeepingEvent | null>;
}

/** Where a guest's conversation happens: the site's own chat, or a channel the hotel bridges into it. */
export type ConversationChannel = 'chat' | 'email' | 'whatsapp' | 'sms';

/** One guest's thread with the hotel — `/admin/communications`. Keyed to a booking when there is one. */
export interface Conversation {
  id: string;
  hotelId: string;
  channel: ConversationChannel;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  bookingReference: string | null;
  /** The newest message's text and time, denormalised so the list needs no second query. */
  lastMessage: string;
  lastMessageAt: string;
  /** Guest messages the desk has not opened yet. */
  unread: number;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  /** `guest` wrote in; `hotel` is a team member's reply; `system` is a booking timeline event. */
  from: 'guest' | 'hotel' | 'system';
  author: string;
  body: string;
  sentAt: string;
  /** Provider acceptance is not proof of inbox delivery; absent on historical messages. */
  deliveryStatus?: 'accepted' | 'demo_only' | 'failed';
}

/**
 * The durable half of `/admin/communications`: threads and their messages,
 * D1 with an in-memory fallback like the others. `markRead` zeroes a
 * thread's unread count; `saveMessage` appends and refreshes the thread's
 * last-message fields in one go.
 */
/**
 * How a desk reply leaves the building on a channel other than the site's
 * own chat: email, WhatsApp, SMS. The demo adapter only logs; a production
 * one is a mail or messaging provider behind this same shape.
 */
export interface OutboundMessenger {
  send(input: {
    channel: Exclude<ConversationChannel, 'chat'>;
    to: { email: string; phone: string | null };
    guestName: string;
    hotelName: string;
    body: string;
    conversationId: string;
    /** A desk reply has none — it's a line in an existing thread. A system email always has one. */
    subject?: string;
    /** A designed HTML alternative to `body` — only an automation's email carries one (`lib/application/email-html.ts`); a desk's own reply is plain text. Ignored for a channel other than `email`. */
    html?: string;
  }): Promise<'accepted' | 'demo_only'>;
}

/**
 * What sets an automation off: three booking-lifecycle events fired by the
 * code that already handles them (`BookingService.confirm`, a cancel, the
 * desk marking a stay checked out), and two calendar-relative moments swept
 * daily by `EmailAutomationsService.sendScheduled` — so many days before
 * check-in, or so many days after check-out. `days` only applies to the
 * latter two.
 */
export const AUTOMATION_TRIGGER_KINDS = ['booking_confirmed', 'booking_cancelled', 'checked_out', 'before_check_in', 'after_check_out'] as const;
export type AutomationTriggerKind = (typeof AUTOMATION_TRIGGER_KINDS)[number];

export interface AutomationTrigger {
  kind: AutomationTriggerKind;
  /** Required for 'before_check_in' and 'after_check_out'; unused otherwise. */
  days?: number;
}

/**
 * One email automation — the four the product ships with, plus whatever a
 * hotel team builds on `/admin/settings/automations`. `builtIn` ones can't
 * be deleted and their trigger *kind* can't change (each is what the
 * matching lifecycle event fires), but their days, subject, body and on/off
 * switch are as editable as a custom rule's.
 */
export interface EmailAutomationRule {
  id: string;
  hotelId: string;
  trigger: AutomationTrigger;
  enabled: boolean;
  subject: string;
  body: string;
  builtIn: boolean;
  updatedAt: string;
}

export interface AutomationRuleStore {
  list(hotelId: string): Promise<EmailAutomationRule[]>;
  upsert(rule: EmailAutomationRule): Promise<void>;
  delete(hotelId: string, id: string): Promise<void>;
}

/**
 * One row per guest an automation has already emailed — the daily sweep's
 * only defence against sending "3 days after check-out" again on tomorrow's
 * run, or several times the same day on Cloudflare's ten-minute tick. Event
 * triggers (`booking_confirmed`, `booking_cancelled`, `checked_out`) fire
 * once, from the code path that already guards their own event, so they
 * don't need this.
 */
export interface AutomationSendLogStore {
  wasSent(ruleId: string, bookingId: string): Promise<boolean>;
  markSent(hotelId: string, ruleId: string, bookingId: string): Promise<void>;
}

export interface MessagingStore {
  listConversations(hotelId: string, limit?: number): Promise<Conversation[]>;
  countUnreadConversations(hotelId: string): Promise<number>;
  getConversation(hotelId: string, id: string): Promise<Conversation | null>;
  saveConversation(conversation: Conversation): Promise<void>;
  listMessages(conversationId: string): Promise<ChatMessage[]>;
  saveMessage(message: ChatMessage): Promise<void>;
  setDeliveryStatus(messageId: string, status: NonNullable<ChatMessage['deliveryStatus']>): Promise<void>;
  markRead(conversationId: string): Promise<void>;
  /** The thread and every message in it, gone for good; `false` when it isn't this hotel's. */
  deleteConversation(hotelId: string, id: string): Promise<boolean>;
}

/** `/admin/accounting/reports`' "Daily list" report types: who arrives, who leaves, who is already in house on a given date. */
export type ReportType = 'arrivals' | 'departures' | 'in_house';

/** The "Online" tab's other views — a date range rather than a single day, each with its own row shape below. */
export type ReportPeriodView = 'manager' | 'financial' | 'ledger' | 'statistics';

/** Anything the "Generated" tab can hold a frozen copy of. */
export type GeneratedReportKind = ReportType | ReportPeriodView;

/** One booking's line in a generated report — a flat, already-formatted snapshot, not a `Booking` reference. */
export interface GeneratedReportRow {
  bookingId: string;
  reference: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  roomTypeName: string;
  roomNumber: string | null;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  total: number;
  currency: Currency;
  /** Set on a "Financial"/"Guest ledger"/"Statistics" snapshot; absent from a daily "Arrivals"/"Departures"/"In house" one. */
  breakfastGuests?: number;
  diningItems?: string[];
}

/** "Manager analytics"' one line per room type — occupancy and booked value over the period, not a booking. */
export interface GeneratedRoomTypeRow {
  id: string;
  name: string;
  rooms: number;
  occupiedNights: number;
  availableNights: number;
  bookingValues: Partial<Record<Currency, number>>;
}

/** "Statistics"' one line per physical room: its housekeeping state next to whoever is in it, frozen together. */
export interface GeneratedStatisticsRow {
  id: string;
  roomNumber: string | null;
  booking: GeneratedReportRow | null;
  housekeepingStatus: HousekeepingStatus | null;
  note: string | null;
}

/**
 * A report someone asked the back office to generate: the filter it was run
 * with, frozen row data as of that moment, and who ran it — the "Generated"
 * tab's grid, as opposed to the "Online" tab's live, unsaved query. Frozen
 * rather than re-queried on open so a report stays what it said when it was
 * handed to someone, even if a booking is cancelled afterwards.
 *
 * `date` is the single day for a "Daily list" report, or a period's first
 * day for the other four kinds — `to` is that period's last day, absent
 * (same as `date`) on a daily one. Exactly one of `rows`/`roomTypeRows`/
 * `statisticsRows` is populated, chosen by `type`: `rows` for a daily kind
 * or "Financial"/"Guest ledger", `roomTypeRows` for "Manager analytics",
 * `statisticsRows` for "Statistics".
 */
export interface GeneratedReport {
  id: string;
  hotelId: string;
  type: GeneratedReportKind;
  date: string;
  to?: string;
  generatedAt: string;
  generatedBy: string;
  rows: GeneratedReportRow[];
  roomTypeRows?: GeneratedRoomTypeRow[];
  statisticsRows?: GeneratedStatisticsRow[];
}

/** The durable half of the "Generated" reports tab. */
export interface GeneratedReportStore {
  list(hotelId: string): Promise<GeneratedReport[]>;
  get(hotelId: string, id: string): Promise<GeneratedReport | null>;
  save(report: GeneratedReport): Promise<void>;
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

/**
 * What the admin assistant understood from a request — which of a fixed set
 * of actions, and the words the admin used for its target. Never an id and
 * never a resolved entity: `admin-assistant-service.ts` matches `target`
 * against the live catalog itself, so the model cannot point a change at
 * something it made up. See `lib/domain/admin-assistant.ts`.
 */
export type AdminCommand = import('./admin-assistant').AdminCommandWire;

/** The words the interpreter may use for a target — the catalog's own names, nothing else. */
export interface AdminCommandVocabulary {
  roomTypes: string[];
  addOns: string[];
}

/** One earlier message of the conversation, for the interpreter's context only — never a fact. */
export interface AdminChatTurn {
  role: 'admin' | 'assistant';
  text: string;
}

export interface AdminCommandInterpreter {
  interpret(input: {
    utterance: string;
    vocabulary: AdminCommandVocabulary;
    /** What is being set up mid-conversation, if anything — the reply is then an answer to its open question. */
    draft: import('./admin-assistant').AdminDraft | null;
    history: AdminChatTurn[];
  }): Promise<AdminCommand>;
}

/**
 * A photographed product turned into an add-on draft — see
 * `product-recognition.ts`. `null` from the application-level adapter means
 * no model is configured, and the desk fills the form in by hand.
 */
export interface ProductRecognizer {
  recognize(input: {
    imageBase64: string;
    mimeType: string;
    hotelName: string;
    currency: string;
    /** The extras already on sale, so a known product keeps its name. */
    existingNames: string[];
  }): Promise<import('./product-recognition').ProductGuess>;
}

/** A photographed guest room turned into a room-type draft — see `room-recognition.ts`; the same `null`-when-keyless rule as `ProductRecognizer`. */
export interface RoomRecognizer {
  recognize(input: {
    imageBase64: string;
    mimeType: string;
    hotelName: string;
    /** The room types already in the catalog, so a known room keeps its name. */
    existingNames: string[];
  }): Promise<import('./room-recognition').RoomGuess>;
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
 * Reserved for general media deletion. Photo upload and lookup currently
 * share MediaLibraryPort so newly stored photos immediately pass validation.
 */
export interface MediaStoragePort {
  upload(input: { filename: string; contentType: string; bytes: ArrayBuffer }): Promise<MediaAsset>;
  delete(url: string): Promise<void>;
}

/** Media vocabulary and durable photo uploads used by the CMS service. */
export interface MediaLibraryPort {
  list(): MediaAsset[] | Promise<MediaAsset[]>;
  find(url: string): MediaAsset | undefined | Promise<MediaAsset | undefined>;
  /** `kind` files the object where `mediaTypeOf` will read it back as a 360° view (`panoramas/…`) or a photo (`photos/…`). */
  upload?(input: { hotelId: string; filename: string; contentType: string; width: number; height: number; bytes: ArrayBuffer; kind?: 'photo' | 'panorama' }): Promise<MediaAsset>;
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
 * Where the building spinner's uploaded frames live — R2, resolved through
 * `lib/infrastructure/durable-spinner-frame-storage.ts` the same
 * call-time-or-in-memory-fallback way D1 is. A frame set is uploaded under a
 * fresh `frameSetId` (the client mints one per upload session with
 * `crypto.randomUUID()`), so an upload in progress never collides with, or
 * is overwritten by, whatever frame set is already live; `deleteFrameSet`
 * sweeps the previous one only after `ContentService.updateSpinnerScene` has
 * successfully pointed `Hotel.spinner` at the new one.
 */
export interface SpinnerFrameStoragePort {
  /** Returns the URL the frame is served at (`app/media/[...path]/route.ts`). */
  putFrame(input: {
    hotelId: string;
    frameSetId: string;
    index: number;
    contentType: string;
    bytes: ArrayBuffer;
  }): Promise<string>;
  deleteFrameSet(hotelId: string, frameSetId: string): Promise<void>;
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

/** External public-holiday calendar. An unavailable provider returns null, never invented dates. */
export interface PublicHolidayPort {
  list(countryCode: string, year: number): Promise<Array<{
    date: string;
    name: string;
    nationalHoliday: boolean;
    holidayTypes: string[];
  }> | null>;
}
