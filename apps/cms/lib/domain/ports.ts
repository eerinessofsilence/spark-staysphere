import type { AddOn, Hotel, PhysicalRoom, RatePlan, RoomType } from './schemas';
import type { SpinnerZone, SpinnerZoneUpsert } from './spinner-markup';
export interface CatalogReader {
  getHotel(slug: string): Promise<Hotel | null>;
  /** Resolve a hotel's policy defaults by the stable id carried on bookings. */
  getHotelById?(hotelId: string): Promise<Hotel | null>;
  listRooms(hotelId: string): Promise<RoomType[]>;
  /** Every door in the building, hidden room types' included. `getAvailability` counts these. */
  listPhysicalRooms(hotelId: string): Promise<PhysicalRoom[]>;
  listRatePlans(roomTypeId: string): Promise<RatePlan[]>;
  listAddOns(hotelId: string): Promise<AddOn[]>;
}

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
