import { z } from 'zod';
import { nightsInRange } from '../domain/availability';
import { effectiveVersion } from '../domain/catalog-overlay';
import { isEquirectangular, isPanorama } from '../domain/media';
import { floorOf, nextRoomNumber } from '../domain/room-units';
import { KEBAB_CASE, kebabSuggestion } from '../domain/slug';
import type {
  CatalogContentPort,
  CatalogEntryKind,
  HotelRepository,
  MediaLibraryPort,
} from '../domain/ports';
import {
  addOnSchema,
  hotelSchema,
  physicalRoomSchema,
  ratePlanSchema,
  ROOM_NUMBER,
  roomTypeSchema,
  type AddOn,
  type Booking,
  type Hotel,
  type PhysicalRoom,
  type RatePlan,
  type RoomType,
} from '../domain/schemas';

/**
 * All CMS business rules live here, never in a server action or a component
 * — see CLAUDE.md's "Business rules live in lib/application" rule. Every
 * mutator starts with `assertCanEditContent()`, the single authorization
 * choke point: it always allows for now (auth is roadmap step 7), but every
 * write in the CMS goes through it, so adding real auth later is a change to
 * one function.
 *
 * Reads go through `HotelRepository`, which already returns seed merged with
 * the CMS overlay (see `durable-hotel-repository.ts`) — so everything here
 * sees the *current* catalog, hidden rooms included, never raw seed data.
 * Writes go through `CatalogContentPort`, which only ever touches the
 * overlay; the seed in `mock-data.ts` is never mutated.
 */

export function assertCanEditContent(): void {
  // No-op until /admin gets auth (CLAUDE.md roadmap step 7). Every mutator
  // below calls this first so that step is a change to this function alone.
}

const KEBAB_MESSAGE = 'Use lowercase letters, numbers, and hyphens only, e.g. "garden-loft".';
const ROOM_NUMBER_MESSAGE = 'Use the floor, then a two-digit position: "305", or "G04" on the ground floor.';

/** Appends `-2`, `-3`, … until the id is free — ids are internal, never shown as a field. */
function uniqueId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The most stays of one room type sharing a single night, from tonight on. */
function peakNightlyStays(stays: Booking[]): number {
  const today = todayIso();
  const perNight = new Map<string, number>();
  for (const stay of stays) {
    for (const night of nightsInRange(stay.checkIn, stay.checkOut)) {
      if (night >= today) perNight.set(night, (perNight.get(night) ?? 0) + 1);
    }
  }
  return Math.max(0, ...perNight.values());
}

export type ContentError =
  | { kind: 'validation'; fieldErrors: Record<string, string[]> }
  | { kind: 'conflict'; currentVersion: number }
  | { kind: 'not_found' }
  | { kind: 'rule'; field?: string; message: string };

export type ContentResult<T> = { ok: true; value: T } | { ok: false; error: ContentError };

function ok<T>(value: T): ContentResult<T> {
  return { ok: true, value };
}
function fail<T>(error: ContentError): ContentResult<T> {
  return { ok: false, error };
}
function ruleError<T>(message: string, field?: string): ContentResult<T> {
  return fail({ kind: 'rule', message, field });
}
function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

const mediaItemSchema = z.object({
  type: z.enum(['image', '360']),
  url: z.string().min(1),
  label: z.string().optional(),
});

const hotelAreaInputSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Enter a name.'),
  description: z.string().min(1, 'Enter a description.'),
  photoAlt: z.string().min(1, 'Enter alt text.'),
  hotspots: z.array(
    z.object({
      id: z.string(),
      label: z.string().min(1, 'Enter a label.'),
      description: z.string().min(1, 'Enter a description.'),
      cta: z.string().min(1, 'Enter a call to action.'),
    }),
  ),
});

export const hotelContentInputSchema = z.object({
  name: z.string().min(1, 'Enter a name.'),
  tagline: z.string().min(1, 'Enter a tagline.'),
  location: z.string().min(1, 'Enter a location.'),
  starRating: z.number().int().min(1, 'Pick a star rating.').max(5, 'Pick a star rating.'),
  /** Never edited from `/admin/content/hotel` — areas keep their current copy unless something else patches them. */
  areas: z.array(hotelAreaInputSchema),
});
export type HotelContentInput = z.infer<typeof hotelContentInputSchema>;

const roomFieldsSchema = z.object({
  name: z.string().min(1, 'Enter a name.'),
  description: z.string().min(1, 'Enter a description.'),
  areaM2: z.number().positive('Enter the room size in m².'),
  floor: z.number().int().nonnegative('Enter a floor of 0 or higher.'),
  capacity: z.number().int().positive('Enter how many guests it sleeps.'),
  bedType: z.enum(['king', 'twin', 'queen']),
  view: z.enum(['sea', 'garden', 'pool', 'city']),
  amenities: z.array(z.string().min(1)),
  media: z.array(mediaItemSchema),
});
export type RoomFieldsInput = z.infer<typeof roomFieldsSchema>;

const createRoomSchema = roomFieldsSchema.extend({
  slug: z.string().min(1, 'Enter a slug.').regex(KEBAB_CASE, KEBAB_MESSAGE),
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

const physicalRoomFieldsSchema = z.object({
  number: z.string().trim().toUpperCase().regex(ROOM_NUMBER, ROOM_NUMBER_MESSAGE),
});
export type PhysicalRoomFieldsInput = z.infer<typeof physicalRoomFieldsSchema>;

const createPhysicalRoomSchema = physicalRoomFieldsSchema.extend({
  roomTypeId: z.string().min(1, 'Pick a room type.'),
});

const rateFieldsSchema = z.object({
  name: z.string().min(1, 'Enter a name.'),
  nightlyPrice: z.number().nonnegative('Enter a price of 0 or higher.'),
  otaComparisonPrice: z.number().nonnegative().optional(),
  breakfastIncluded: z.boolean(),
  includedServices: z.array(z.string().min(1)),
  cancellationPolicy: z.string().min(1, 'Enter the cancellation policy.'),
});
export type RateFieldsInput = z.infer<typeof rateFieldsSchema>;

const addOnFieldsSchema = z.object({
  name: z.string().min(1, 'Enter a name.'),
  description: z.string().min(1, 'Enter a description.'),
  category: z.enum(['service', 'dining']),
  parentId: z.string().optional(),
  /** Urls only — width/height are resolved from the media library, never trusted from the client. */
  photos: z.array(z.string().min(1)).optional(),
  price: z.number().nonnegative('Enter a price of 0 or higher.'),
  pricingUnit: z.enum(['per_stay', 'per_night', 'per_guest']),
  enabled: z.boolean(),
});
export type AddOnFieldsInput = z.infer<typeof addOnFieldsSchema>;

export interface Versioned {
  version: number;
}

export class ContentService {
  constructor(
    private readonly repository: HotelRepository,
    private readonly content: CatalogContentPort,
    private readonly media: MediaLibraryPort,
    private readonly hotelSlug: string,
    /** Which ids came from `mock-data.ts` — the only entities a hard delete is refused for. */
    private readonly seedIds: Record<CatalogEntryKind, ReadonlySet<string>>,
  ) {}

  private async hotel(): Promise<Hotel> {
    const hotel = await this.repository.getHotel(this.hotelSlug);
    if (!hotel) throw new Error(`Demo hotel "${this.hotelSlug}" is missing its seed record.`);
    return hotel;
  }

  private async versionOf(kind: CatalogEntryKind, id: string): Promise<number> {
    const entry = await this.content.getEntry(kind, id);
    return entry?.version ?? 0;
  }

  private isSeed(kind: CatalogEntryKind, id: string): boolean {
    return this.seedIds[kind].has(id);
  }

  private async referencedByBooking(
    kind: 'room' | 'rate' | 'addon',
    id: string,
  ): Promise<boolean> {
    const bookings = await this.repository.listBookings();
    if (kind === 'room') return bookings.some((booking) => booking.roomTypeId === id);
    if (kind === 'rate') return bookings.some((booking) => booking.ratePlanId === id);
    return bookings.some((booking) => booking.addOnIds.includes(id));
  }

  /** Confirmed stays of a room type that haven't checked out yet. */
  private async currentStays(roomTypeId: string): Promise<Booking[]> {
    const today = todayIso();
    return (await this.repository.listBookings()).filter(
      (booking) => booking.status === 'confirmed' && booking.roomTypeId === roomTypeId && booking.checkOut > today,
    );
  }

  /**
   * Resolves a media item's `url` against the library and fills in the
   * dimensions from there — a client never gets to assert its own width or
   * height. Returns a field error path (e.g. `media.1.url`) on the first
   * problem found.
   */
  private resolveMedia(
    items: z.infer<typeof mediaItemSchema>[],
    fieldPrefix: string,
  ): { ok: true; media: RoomType['media'] } | { ok: false; fieldErrors: Record<string, string[]> } {
    const media: RoomType['media'] = [];
    for (const [index, item] of items.entries()) {
      const asset = this.media.find(item.url);
      const path = `${fieldPrefix}.${index}.url`;
      if (!asset) return { ok: false, fieldErrors: { [path]: ['Pick a photo from the media library.'] } };
      if (item.type === '360' && !(isPanorama(asset) && isEquirectangular(asset))) {
        return {
          ok: false,
          fieldErrors: { [path]: ['A 360° view must be an equirectangular (2:1) panorama.'] },
        };
      }
      media.push({ type: item.type, url: item.url, label: item.label, width: asset.width, height: asset.height });
    }
    return { ok: true, media };
  }

  private resolvePhotos(
    urls: string[] | undefined,
  ): { ok: true; photos: AddOn['photos'] } | { ok: false; fieldErrors: Record<string, string[]> } {
    if (!urls || urls.length === 0) return { ok: true, photos: undefined };
    const photos: NonNullable<AddOn['photos']> = [];
    for (const [index, url] of urls.entries()) {
      const asset = this.media.find(url);
      if (!asset) {
        return { ok: false, fieldErrors: { [`photos.${index}`]: ['Pick a photo from the media library.'] } };
      }
      photos.push({ url, width: asset.width, height: asset.height });
    }
    return { ok: true, photos };
  }

  /** Everything the media picker can offer — see `lib/infrastructure/media-library.ts`. */
  listMedia() {
    return this.media.list();
  }

  /** Whether an entity came with the demo catalog — a page uses this to not offer a delete the service would refuse. */
  isSeedEntry(kind: CatalogEntryKind, id: string): boolean {
    return this.isSeed(kind, id);
  }

  // ---------------------------------------------------------------- Hotel

  async getHotelContent(): Promise<{ hotel: Hotel; version: number }> {
    const hotel = await this.hotel();
    return { hotel, version: await this.versionOf('hotel', hotel.id) };
  }

  async updateHotel(rawInput: unknown, expectedVersion: number): Promise<ContentResult<Versioned>> {
    assertCanEditContent();
    const parsed = hotelContentInputSchema.safeParse(rawInput);
    if (!parsed.success) return fail({ kind: 'validation', fieldErrors: fieldErrorsOf(parsed.error) });
    const input = parsed.data;

    const current = await this.hotel();

    // Every area/hotspot in `input` is matched against `current` by id and
    // only its editable fields are copied across — an id the client sends
    // that `current` doesn't have is silently ignored, since the CMS never
    // creates a new area or hotspot, only edits the copy a photo already has.
    const nextAreas = current.areas.map((area) => {
      const patch = input.areas.find((candidate) => candidate.id === area.id);
      if (!patch) return area;
      return {
        ...area,
        name: patch.name,
        description: patch.description,
        photo: { ...area.photo, alt: patch.photoAlt },
        hotspots: area.hotspots.map((hotspot) => {
          const hotspotPatch = patch.hotspots.find((candidate) => candidate.id === hotspot.id);
          if (!hotspotPatch) return hotspot;
          return { ...hotspot, label: hotspotPatch.label, description: hotspotPatch.description, cta: hotspotPatch.cta };
        }),
      };
    });

    const next = hotelSchema.parse({
      ...current,
      name: input.name,
      tagline: input.tagline,
      location: input.location,
      starRating: input.starRating,
      areas: nextAreas,
    } satisfies Hotel);

    const result = await this.content.upsertEntry({
      kind: 'hotel',
      id: current.id,
      hotelId: current.id,
      data: next,
      expectedVersion,
    });
    if (!result.ok) return fail({ kind: 'conflict', currentVersion: result.currentVersion });
    return ok({ version: result.version });
  }

  // ------------------------------------------------------------ Room types

  async listRoomsContent(): Promise<Array<RoomType & Versioned>> {
    const hotel = await this.hotel();
    const rooms = await this.repository.listRooms(hotel.id);
    return Promise.all(rooms.map(async (room) => ({ ...room, version: await this.versionOf('room', room.id) })));
  }

  async getRoomContent(id: string): Promise<(RoomType & Versioned) | null> {
    const hotel = await this.hotel();
    const room = (await this.repository.listRooms(hotel.id)).find((candidate) => candidate.id === id);
    if (!room) return null;
    return { ...room, version: await this.versionOf('room', id) };
  }

  /**
   * New room types start hidden: `setRoomHidden` never lets one go on sale
   * without at least one room, a rate and a photo, and a type has none of
   * those at the moment it's created — its rooms are added next, under Rooms.
   */
  async createRoom(rawInput: unknown): Promise<ContentResult<{ id: string } & Versioned>> {
    assertCanEditContent();
    const parsed = createRoomSchema.safeParse(rawInput);
    if (!parsed.success) return fail({ kind: 'validation', fieldErrors: fieldErrorsOf(parsed.error) });
    const input = parsed.data;

    const slug = input.slug;
    if (kebabSuggestion(slug) !== slug) {
      return fail({ kind: 'validation', fieldErrors: { slug: [KEBAB_MESSAGE] } });
    }

    const hotel = await this.hotel();
    const rooms = await this.repository.listRooms(hotel.id);
    if (rooms.some((room) => room.slug === slug)) {
      return fail({ kind: 'validation', fieldErrors: { slug: ['That slug is already in use.'] } });
    }

    const media = this.resolveMedia(input.media, 'media');
    if (!media.ok) return fail({ kind: 'validation', fieldErrors: media.fieldErrors });

    const id = `room_${slug}`;
    const room = roomTypeSchema.parse({
      id,
      hotelId: hotel.id,
      slug,
      name: input.name,
      description: input.description,
      areaM2: input.areaM2,
      floor: input.floor,
      capacity: input.capacity,
      bedType: input.bedType,
      view: input.view,
      amenities: input.amenities,
      media: media.media,
      hidden: true,
    } satisfies RoomType);

    const result = await this.content.upsertEntry({ kind: 'room', id, hotelId: hotel.id, data: room, expectedVersion: 0 });
    if (!result.ok) return fail({ kind: 'conflict', currentVersion: result.currentVersion });
    return ok({ id, version: result.version });
  }

  async updateRoom(id: string, rawInput: unknown, expectedVersion: number): Promise<ContentResult<Versioned>> {
    assertCanEditContent();
    const current = await this.getRoomContent(id);
    if (!current) return fail({ kind: 'not_found' });

    const parsed = roomFieldsSchema.safeParse(rawInput);
    if (!parsed.success) return fail({ kind: 'validation', fieldErrors: fieldErrorsOf(parsed.error) });
    const input = parsed.data;

    const media = this.resolveMedia(input.media, 'media');
    if (!media.ok) return fail({ kind: 'validation', fieldErrors: media.fieldErrors });

    if (!current.hidden && !media.media.some((item) => item.type === 'image')) {
      return ruleError('This room is on sale, so it needs at least one photo. Add one, or hide the room first.', 'media');
    }

    const { version: _version, ...rest } = current;
    const next = roomTypeSchema.parse({
      ...rest,
      name: input.name,
      description: input.description,
      areaM2: input.areaM2,
      floor: input.floor,
      capacity: input.capacity,
      bedType: input.bedType,
      view: input.view,
      amenities: input.amenities,
      media: media.media,
    } satisfies RoomType);

    const result = await this.content.upsertEntry({
      kind: 'room',
      id,
      hotelId: next.hotelId,
      data: next,
      expectedVersion,
    });
    if (!result.ok) return fail({ kind: 'conflict', currentVersion: result.currentVersion });
    return ok({ version: result.version });
  }

  async setRoomHidden(id: string, hidden: boolean, expectedVersion: number): Promise<ContentResult<Versioned>> {
    assertCanEditContent();
    const current = await this.getRoomContent(id);
    if (!current) return fail({ kind: 'not_found' });

    if (!hidden) {
      const rooms = await this.repository.listPhysicalRooms(current.hotelId);
      if (!rooms.some((room) => room.roomTypeId === id)) {
        return ruleError('Add at least one room of this type before showing it on the site.');
      }
      const rates = await this.repository.listRatePlans(id);
      if (rates.length === 0) return ruleError('Add a rate before showing this room on the site.');
      if (!current.media.some((item) => item.type === 'image')) {
        return ruleError('Add a photo before showing this room on the site.');
      }
    }

    const { version: _version, ...rest } = current;
    const next = roomTypeSchema.parse({ ...rest, hidden } satisfies RoomType);
    const result = await this.content.upsertEntry({
      kind: 'room',
      id,
      hotelId: next.hotelId,
      data: next,
      expectedVersion,
    });
    if (!result.ok) return fail({ kind: 'conflict', currentVersion: result.currentVersion });
    return ok({ version: result.version });
  }

  /**
   * Only a CMS-created room type with no bookings and no rooms left under it.
   * Its rates go with it — a rate means nothing without its type, and a
   * CMS-created type only ever has CMS-created rates.
   */
  async deleteRoom(id: string): Promise<ContentResult<null>> {
    assertCanEditContent();
    const current = await this.getRoomContent(id);
    if (!current) return fail({ kind: 'not_found' });
    if (this.isSeed('room', id)) {
      return ruleError('This room type came with the demo catalog and can only be edited or hidden, not removed.');
    }
    if (await this.referencedByBooking('room', id)) {
      return ruleError('This room type has bookings against it and cannot be removed. Hide it instead.');
    }
    const rooms = (await this.repository.listPhysicalRooms(current.hotelId)).filter((room) => room.roomTypeId === id);
    if (rooms.length > 0) {
      return ruleError(
        `This room type still has ${rooms.length === 1 ? '1 room' : `${rooms.length} rooms`} under it. Remove them under Rooms first.`,
      );
    }
    for (const rate of await this.repository.listRatePlans(id)) {
      await this.content.deleteEntry('rate', rate.id);
    }
    await this.content.deleteEntry('room', id);
    return ok(null);
  }

  // -------------------------------------------------------- Physical rooms

  async listPhysicalRoomsContent(): Promise<Array<PhysicalRoom & Versioned>> {
    const hotel = await this.hotel();
    const [rooms, overlay] = await Promise.all([
      this.repository.listPhysicalRooms(hotel.id),
      this.content.listEntries('unit', hotel.id),
    ]);
    return rooms.map((room) => ({ ...room, version: effectiveVersion(overlay, room.id) }));
  }

  async getPhysicalRoomContent(id: string): Promise<(PhysicalRoom & Versioned) | null> {
    return (await this.listPhysicalRoomsContent()).find((room) => room.id === id) ?? null;
  }

  /** Room type id → the first free number on that type's floor, for the new-room form to start from. */
  async suggestRoomNumbers(): Promise<Record<string, string>> {
    const hotel = await this.hotel();
    const [types, rooms] = await Promise.all([
      this.repository.listRooms(hotel.id),
      this.repository.listPhysicalRooms(hotel.id),
    ]);
    return Object.fromEntries(types.map((type) => [type.id, nextRoomNumber(type.floor, rooms)]));
  }

  /** A room's floor is read off its number, so the two can never disagree. */
  async createPhysicalRoom(rawInput: unknown): Promise<ContentResult<{ id: string } & Versioned>> {
    assertCanEditContent();
    const parsed = createPhysicalRoomSchema.safeParse(rawInput);
    if (!parsed.success) return fail({ kind: 'validation', fieldErrors: fieldErrorsOf(parsed.error) });
    const input = parsed.data;

    const hotel = await this.hotel();
    const [types, rooms] = await Promise.all([
      this.repository.listRooms(hotel.id),
      this.repository.listPhysicalRooms(hotel.id),
    ]);
    const type = types.find((candidate) => candidate.id === input.roomTypeId);
    if (!type) return fail({ kind: 'validation', fieldErrors: { roomTypeId: ['Pick an existing room type.'] } });
    if (rooms.some((room) => room.number === input.number)) {
      return fail({ kind: 'validation', fieldErrors: { number: [`Room ${input.number} already exists.`] } });
    }

    const id = uniqueId(`unit_${input.number}`, new Set(rooms.map((room) => room.id)));
    const room = physicalRoomSchema.parse({
      id,
      hotelId: hotel.id,
      roomTypeId: type.id,
      number: input.number,
      floor: floorOf(input.number),
    } satisfies PhysicalRoom);

    const result = await this.content.upsertEntry({ kind: 'unit', id, hotelId: hotel.id, data: room, expectedVersion: 0 });
    if (!result.ok) return fail({ kind: 'conflict', currentVersion: result.currentVersion });
    return ok({ id, version: result.version });
  }

  async updatePhysicalRoom(id: string, rawInput: unknown, expectedVersion: number): Promise<ContentResult<Versioned>> {
    assertCanEditContent();
    const current = await this.getPhysicalRoomContent(id);
    if (!current) return fail({ kind: 'not_found' });

    const parsed = physicalRoomFieldsSchema.safeParse(rawInput);
    if (!parsed.success) return fail({ kind: 'validation', fieldErrors: fieldErrorsOf(parsed.error) });
    const { number } = parsed.data;

    if (number !== current.number) {
      const rooms = await this.repository.listPhysicalRooms(current.hotelId);
      if (rooms.some((room) => room.id !== id && room.number === number)) {
        return fail({ kind: 'validation', fieldErrors: { number: [`Room ${number} already exists.`] } });
      }
      const chosen = (await this.currentStays(current.roomTypeId)).find((stay) => stay.unitNumber === current.number);
      if (chosen) {
        return ruleError(
          `A guest chose room ${current.number} for booking ${chosen.reference}, so its number can't change until that stay is over.`,
          'number',
        );
      }
    }

    const { version: _version, ...rest } = current;
    const next = physicalRoomSchema.parse({ ...rest, number, floor: floorOf(number) } satisfies PhysicalRoom);
    const result = await this.content.upsertEntry({
      kind: 'unit',
      id,
      hotelId: next.hotelId,
      data: next,
      expectedVersion,
    });
    if (!result.ok) return fail({ kind: 'conflict', currentVersion: result.currentVersion });
    return ok({ version: result.version });
  }

  /**
   * Removing a room takes a night of capacity away from its type, so it is
   * refused whenever what's left couldn't hold the stays already booked.
   */
  async deletePhysicalRoom(id: string): Promise<ContentResult<null>> {
    assertCanEditContent();
    const current = await this.getPhysicalRoomContent(id);
    if (!current) return fail({ kind: 'not_found' });
    if (this.isSeed('unit', id)) {
      return ruleError('This room came with the demo building. It can be renumbered, not removed.');
    }

    const [types, rooms, stays] = await Promise.all([
      this.repository.listRooms(current.hotelId),
      this.repository.listPhysicalRooms(current.hotelId),
      this.currentStays(current.roomTypeId),
    ]);
    const chosen = stays.find((stay) => stay.unitNumber === current.number);
    if (chosen) {
      return ruleError(`A guest chose this room for booking ${chosen.reference}. It can be removed once that stay is over.`);
    }

    const type = types.find((candidate) => candidate.id === current.roomTypeId);
    const left = rooms.filter((room) => room.roomTypeId === current.roomTypeId && room.id !== id).length;
    if (type && !type.hidden && left === 0) {
      return ruleError(
        `This is the last ${type.name} room and that room type is on sale. Hide the room type first, or add another room.`,
      );
    }
    const peak = peakNightlyStays(stays);
    if (peak > left) {
      return ruleError(
        `${type?.name ?? 'This room type'} has ${peak} stays booked on the same night, so it needs at least ${peak} rooms.`,
      );
    }

    await this.content.deleteEntry('unit', id);
    return ok(null);
  }

  // ----------------------------------------------------------------- Rates

  async listRatesContent(roomTypeId: string): Promise<Array<RatePlan & Versioned>> {
    const rates = await this.repository.listRatePlans(roomTypeId);
    return Promise.all(rates.map(async (rate) => ({ ...rate, version: await this.versionOf('rate', rate.id) })));
  }

  private async findRate(id: string): Promise<(RatePlan & Versioned) | null> {
    const hotel = await this.hotel();
    const rooms = await this.repository.listRooms(hotel.id);
    for (const room of rooms) {
      const rate = (await this.repository.listRatePlans(room.id)).find((candidate) => candidate.id === id);
      if (rate) return { ...rate, version: await this.versionOf('rate', id) };
    }
    return null;
  }

  async createRate(roomTypeId: string, rawInput: unknown): Promise<ContentResult<{ id: string } & Versioned>> {
    assertCanEditContent();
    const hotel = await this.hotel();
    const room = (await this.repository.listRooms(hotel.id)).find((candidate) => candidate.id === roomTypeId);
    if (!room) return ruleError('Room type not found.', 'roomTypeId');

    const parsed = rateFieldsSchema.safeParse(rawInput);
    if (!parsed.success) return fail({ kind: 'validation', fieldErrors: fieldErrorsOf(parsed.error) });
    const input = parsed.data;

    const existingRateIds = new Set(
      (await this.repository.listRatePlans(roomTypeId)).map((rate) => rate.id),
    );
    const id = uniqueId(`rate_${room.slug}_${kebabSuggestion(input.name) || 'rate'}`, existingRateIds);

    const rate = ratePlanSchema.parse({
      id,
      roomTypeId,
      name: input.name,
      nightlyPrice: input.nightlyPrice,
      currency: hotel.currency,
      breakfastIncluded: input.breakfastIncluded,
      includedServices: input.includedServices,
      cancellationPolicy: input.cancellationPolicy,
      otaComparisonPrice: input.otaComparisonPrice,
    } satisfies RatePlan);

    const result = await this.content.upsertEntry({ kind: 'rate', id, hotelId: hotel.id, data: rate, expectedVersion: 0 });
    if (!result.ok) return fail({ kind: 'conflict', currentVersion: result.currentVersion });
    return ok({ id, version: result.version });
  }

  async updateRate(id: string, rawInput: unknown, expectedVersion: number): Promise<ContentResult<Versioned>> {
    assertCanEditContent();
    const current = await this.findRate(id);
    if (!current) return fail({ kind: 'not_found' });

    const parsed = rateFieldsSchema.safeParse(rawInput);
    if (!parsed.success) return fail({ kind: 'validation', fieldErrors: fieldErrorsOf(parsed.error) });
    const input = parsed.data;

    const { version: _version, ...rest } = current;
    const next = ratePlanSchema.parse({
      ...rest,
      name: input.name,
      nightlyPrice: input.nightlyPrice,
      breakfastIncluded: input.breakfastIncluded,
      includedServices: input.includedServices,
      cancellationPolicy: input.cancellationPolicy,
      otaComparisonPrice: input.otaComparisonPrice,
    } satisfies RatePlan);

    const hotel = await this.hotel();
    const result = await this.content.upsertEntry({ kind: 'rate', id, hotelId: hotel.id, data: next, expectedVersion });
    if (!result.ok) return fail({ kind: 'conflict', currentVersion: result.currentVersion });
    return ok({ version: result.version });
  }

  async deleteRate(id: string): Promise<ContentResult<null>> {
    assertCanEditContent();
    const current = await this.findRate(id);
    if (!current) return fail({ kind: 'not_found' });
    if (this.isSeed('rate', id)) {
      return ruleError('This rate came with the demo catalog and can only be edited, not removed.');
    }
    if (await this.referencedByBooking('rate', id)) {
      return ruleError('This rate has a booking against it and cannot be removed.');
    }
    const room = await this.getRoomContent(current.roomTypeId);
    if (room && !room.hidden) {
      const rates = await this.repository.listRatePlans(current.roomTypeId);
      if (rates.length <= 1) {
        return ruleError('This is the only rate on a room that is on sale. Hide the room first, or add another rate.');
      }
    }
    await this.content.deleteEntry('rate', id);
    return ok(null);
  }

  // --------------------------------------------------------------- Add-ons

  async listAddOnsContent(): Promise<Array<AddOn & Versioned>> {
    const hotel = await this.hotel();
    const addOns = await this.repository.listAddOns(hotel.id);
    return Promise.all(addOns.map(async (addOn) => ({ ...addOn, version: await this.versionOf('addon', addOn.id) })));
  }

  async getAddOnContent(id: string): Promise<(AddOn & Versioned) | null> {
    const addOns = await this.listAddOnsContent();
    return addOns.find((addOn) => addOn.id === id) ?? null;
  }

  private async validateParent(
    parentId: string | undefined,
    ownId: string | null,
    addOns: AddOn[],
  ): Promise<string | null> {
    if (!parentId) return null;
    if (parentId === ownId) return 'An add-on cannot be its own parent.';
    const parent = addOns.find((addOn) => addOn.id === parentId);
    if (!parent) return 'Pick an existing add-on as the parent.';
    if (parent.parentId) return 'The parent must itself be a top-level add-on — nesting only goes one level.';
    return null;
  }

  async createAddOn(rawInput: unknown): Promise<ContentResult<{ id: string } & Versioned>> {
    assertCanEditContent();
    const parsed = addOnFieldsSchema.safeParse(rawInput);
    if (!parsed.success) return fail({ kind: 'validation', fieldErrors: fieldErrorsOf(parsed.error) });
    const input = parsed.data;

    const hotel = await this.hotel();
    const addOns = await this.repository.listAddOns(hotel.id);
    const parentError = await this.validateParent(input.parentId, null, addOns);
    if (parentError) return fail({ kind: 'validation', fieldErrors: { parentId: [parentError] } });

    const photos = this.resolvePhotos(input.photos);
    if (!photos.ok) return fail({ kind: 'validation', fieldErrors: photos.fieldErrors });

    const id = uniqueId(`addon_${kebabSuggestion(input.name) || 'addon'}`, new Set(addOns.map((addOn) => addOn.id)));
    const addOn = addOnSchema.parse({
      id,
      name: input.name,
      description: input.description,
      category: input.category,
      parentId: input.parentId,
      photos: photos.photos,
      price: input.price,
      currency: hotel.currency,
      pricingUnit: input.pricingUnit,
      enabled: input.enabled,
    } satisfies AddOn);

    const result = await this.content.upsertEntry({ kind: 'addon', id, hotelId: hotel.id, data: addOn, expectedVersion: 0 });
    if (!result.ok) return fail({ kind: 'conflict', currentVersion: result.currentVersion });
    return ok({ id, version: result.version });
  }

  async updateAddOn(id: string, rawInput: unknown, expectedVersion: number): Promise<ContentResult<Versioned>> {
    assertCanEditContent();
    const current = await this.getAddOnContent(id);
    if (!current) return fail({ kind: 'not_found' });

    const parsed = addOnFieldsSchema.safeParse(rawInput);
    if (!parsed.success) return fail({ kind: 'validation', fieldErrors: fieldErrorsOf(parsed.error) });
    const input = parsed.data;

    const hotel = await this.hotel();
    const addOns = await this.repository.listAddOns(hotel.id);
    const parentError = await this.validateParent(input.parentId, id, addOns);
    if (parentError) return fail({ kind: 'validation', fieldErrors: { parentId: [parentError] } });
    if (addOns.some((addOn) => addOn.parentId === id) && input.parentId) {
      return ruleError('This add-on has extras of its own, so it cannot also become an extra. Nesting only goes one level.', 'parentId');
    }

    const photos = this.resolvePhotos(input.photos);
    if (!photos.ok) return fail({ kind: 'validation', fieldErrors: photos.fieldErrors });

    const { version: _version, ...rest } = current;
    const next = addOnSchema.parse({
      ...rest,
      name: input.name,
      description: input.description,
      category: input.category,
      parentId: input.parentId,
      photos: photos.photos,
      price: input.price,
      pricingUnit: input.pricingUnit,
      enabled: input.enabled,
    } satisfies AddOn);

    const result = await this.content.upsertEntry({ kind: 'addon', id, hotelId: hotel.id, data: next, expectedVersion });
    if (!result.ok) return fail({ kind: 'conflict', currentVersion: result.currentVersion });
    return ok({ version: result.version });
  }

  /**
   * The quick on/off switch shared by `/admin` and the CMS — no version
   * field on that control, so this reads the current version itself and
   * retries once if a concurrent edit landed in between.
   */
  async setAddOnEnabled(id: string, enabled: boolean): Promise<ContentResult<Versioned>> {
    assertCanEditContent();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const current = await this.getAddOnContent(id);
      if (!current) return fail({ kind: 'not_found' });
      const { version, ...rest } = current;
      const next = addOnSchema.parse({ ...rest, enabled } satisfies AddOn);
      const hotel = await this.hotel();
      const result = await this.content.upsertEntry({
        kind: 'addon',
        id,
        hotelId: hotel.id,
        data: next,
        expectedVersion: version,
      });
      if (result.ok) return ok({ version: result.version });
    }
    return fail({ kind: 'conflict', currentVersion: await this.versionOf('addon', id) });
  }

  async deleteAddOn(id: string): Promise<ContentResult<null>> {
    assertCanEditContent();
    const current = await this.getAddOnContent(id);
    if (!current) return fail({ kind: 'not_found' });
    if (this.isSeed('addon', id)) {
      return ruleError('This add-on came with the demo catalog and can only be edited or withdrawn, not removed.');
    }
    if (await this.referencedByBooking('addon', id)) {
      return ruleError('This add-on has a booking against it and cannot be removed. Withdraw it instead.');
    }
    const hotel = await this.hotel();
    const addOns = await this.repository.listAddOns(hotel.id);
    if (addOns.some((addOn) => addOn.parentId === id)) {
      return ruleError('This add-on still has extras under it. Remove those first.');
    }
    await this.content.deleteEntry('addon', id);
    return ok(null);
  }

  // ----------------------------------------------------------------- Reset

  async resetContent(): Promise<void> {
    assertCanEditContent();
    const hotel = await this.hotel();
    await this.content.reset(hotel.id);
  }
}
