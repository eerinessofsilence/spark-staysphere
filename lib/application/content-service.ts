import { z } from 'zod';
import { isEquirectangular, isPanorama } from '../domain/media';
import { buildRoomUnits } from '../domain/room-units';
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
  ratePlanSchema,
  roomTypeSchema,
  type AddOn,
  type Hotel,
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

function byRoomNumber(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true });
}

export type ContentError =
  | { kind: 'validation'; fieldErrors: Record<string, string[]> }
  | { kind: 'conflict'; currentVersion: number }
  | { kind: 'not_found' }
  | { kind: 'rule'; field?: string; message: string };

export type ContentResult<T> = { ok: true; value: T } | { ok: false; error: ContentError };

/** Whether a delete is allowed, and if not, why — asked before offering the button, not after it is pressed. */
export type Removal = { allowed: true } | { allowed: false; reason: string };

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

/**
 * The hotel form edits areas and hotspots by id, so its errors are keyed by id too
 * (`areas.pool.description`, `areas.pool.hotspots.bar.cta`) — a flattened `areas` key could not
 * say which of a dozen fields to point at.
 */
function hotelFieldErrors(error: z.ZodError, raw: unknown): Record<string, string[]> {
  const input = (raw ?? {}) as { areas?: Array<{ id?: string; hotspots?: Array<{ id?: string }> }> };
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const [top, areaIndex, field, hotspotIndex, hotspotField] = issue.path;
    let key = String(top ?? 'hotel');
    if (top === 'areas' && typeof areaIndex === 'number') {
      const area = input.areas?.[areaIndex];
      key =
        field === 'hotspots' && typeof hotspotIndex === 'number'
          ? `areas.${area?.id}.hotspots.${area?.hotspots?.[hotspotIndex]?.id}.${String(hotspotField)}`
          : `areas.${area?.id}.${String(field)}`;
    }
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
}

function roomsPhrase(numbers: string[]): string {
  return numbers.length === 1 ? `A guest picked room ${numbers[0]}` : `Guests picked rooms ${numbers.join(', ')}`;
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
  photoAlt: z.string().min(1, 'Describe the photo for screen readers.'),
  hotspots: z.array(
    z.object({
      id: z.string(),
      label: z.string().min(1, 'Enter a label.'),
      description: z.string().min(1, 'Enter a description.'),
      cta: z.string().min(1, 'Enter the button text.'),
    }),
  ),
});

export const hotelContentInputSchema = z.object({
  name: z.string().min(1, 'Enter a name.'),
  tagline: z.string().min(1, 'Enter a tagline.'),
  location: z.string().min(1, 'Enter a location.'),
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
  slug: z.string().min(1, 'Enter a page address.').regex(KEBAB_CASE, KEBAB_MESSAGE),
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

const rateFieldsSchema = z.object({
  name: z.string().min(1, 'Enter a name.'),
  nightlyPrice: z.number().positive('Enter a price greater than 0.'),
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
  price: z.number().positive('Enter a price greater than 0.'),
  pricingUnit: z.enum(['per_stay', 'per_night', 'per_guest']),
  /** Set when an add-on is created. An existing one goes on and off sale through `setAddOnEnabled`. */
  enabled: z.boolean().optional(),
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

  /**
   * Resolves a media item's `url` against the library and fills in the
   * dimensions from there — a client never gets to assert its own width or
   * height. Returns a field error path (e.g. `media.1.url`) on the first
   * problem found. Every item needs a label: the room page shows it as the
   * name of that view.
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
      const label = item.label?.trim();
      if (!label) {
        return {
          ok: false,
          fieldErrors: { [`${fieldPrefix}.${index}.label`]: ['Add a label — guests see it as the name of this view.'] },
        };
      }
      media.push({ type: item.type, url: item.url, label, width: asset.width, height: asset.height });
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

  /**
   * Room numbers are derived from each type's floor and view (`buildRoomUnits`), so moving a type
   * — or adding one to a floor — renumbers rooms. Returns the guest-picked rooms of upcoming stays
   * that would stop pointing at the room the guest chose.
   */
  private async renumberedPicks(before: RoomType[], after: RoomType[]): Promise<string[]> {
    const today = todayIso();
    const picks = (await this.repository.listBookings()).filter(
      (booking) => booking.status === 'confirmed' && booking.unitNumber && booking.checkOut > today,
    );
    if (picks.length === 0) return [];
    const owners = (rooms: RoomType[]) => new Map(buildRoomUnits(rooms).map((unit) => [unit.number, unit.roomTypeId]));
    const was = owners(before);
    const will = owners(after);
    const lost = picks
      .filter((booking) => was.get(booking.unitNumber!) === booking.roomTypeId && will.get(booking.unitNumber!) !== booking.roomTypeId)
      .map((booking) => booking.unitNumber!);
    return [...new Set(lost)].sort(byRoomNumber);
  }

  /** Everything the media picker can offer — see `lib/infrastructure/media-library.ts`. */
  listMedia() {
    return this.media.list();
  }

  // ---------------------------------------------------------------- Hotel

  async getHotelContent(): Promise<{ hotel: Hotel; version: number }> {
    const hotel = await this.hotel();
    return { hotel, version: await this.versionOf('hotel', hotel.id) };
  }

  async updateHotel(rawInput: unknown, expectedVersion: number): Promise<ContentResult<Versioned>> {
    assertCanEditContent();
    const parsed = hotelContentInputSchema.safeParse(rawInput);
    if (!parsed.success) return fail({ kind: 'validation', fieldErrors: hotelFieldErrors(parsed.error, rawInput) });
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

  // ----------------------------------------------------------------- Rooms

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

  /** Rooms of this type a guest picked on the floor plan for a stay that hasn't ended. */
  async pickedRoomNumbers(roomTypeId: string): Promise<string[]> {
    const today = todayIso();
    const bookings = await this.repository.listBookings();
    const numbers = bookings
      .filter(
        (booking) =>
          booking.roomTypeId === roomTypeId && booking.status === 'confirmed' && booking.unitNumber && booking.checkOut > today,
      )
      .map((booking) => booking.unitNumber!);
    return [...new Set(numbers)].sort(byRoomNumber);
  }

  /** New rooms start hidden: `content-service` never lets a room go visible without a rate and a photo (see `setRoomHidden`), and a room cannot carry either at the moment it's created. */
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
      return fail({ kind: 'validation', fieldErrors: { slug: ['That page address is already in use.'] } });
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

    const lost = await this.renumberedPicks(rooms, [...rooms, room]);
    if (lost.length > 0) {
      return ruleError(
        `${roomsPhrase(lost)} for upcoming stays, and a new room type on floor ${input.floor} would renumber them. Pick another floor while those bookings stand.`,
        'floor',
      );
    }

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

    if (input.floor !== current.floor || input.view !== current.view) {
      const rooms = await this.repository.listRooms(current.hotelId);
      const moved = rooms.map((room) => (room.id === id ? { ...room, floor: input.floor, view: input.view } : room));
      const lost = await this.renumberedPicks(rooms, moved);
      if (lost.length > 0) {
        const field = input.floor !== current.floor ? 'floor' : 'view';
        return ruleError(
          `${roomsPhrase(lost)} for upcoming stays, and changing the ${field} would renumber ${lost.length === 1 ? 'it' : 'them'}. Keep the ${field} as it is while ${lost.length === 1 ? 'that booking stands' : 'those bookings stand'}.`,
          field,
        );
      }
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

  async rateRemoval(id: string): Promise<Removal> {
    const current = await this.findRate(id);
    if (!current) return { allowed: false, reason: 'This rate no longer exists.' };
    if (this.isSeed('rate', id)) {
      return { allowed: false, reason: 'Came with the demo catalog — it can be edited, not removed.' };
    }
    if (await this.referencedByBooking('rate', id)) {
      return { allowed: false, reason: 'A booking uses this rate, so it stays.' };
    }
    const room = await this.getRoomContent(current.roomTypeId);
    if (room && !room.hidden) {
      const rates = await this.repository.listRatePlans(current.roomTypeId);
      if (rates.length <= 1) {
        return { allowed: false, reason: 'The only rate on a room that is on the site — hide the room or add another rate first.' };
      }
    }
    return { allowed: true };
  }

  async deleteRate(id: string, expectedVersion: number): Promise<ContentResult<null>> {
    assertCanEditContent();
    const current = await this.findRate(id);
    if (!current) return fail({ kind: 'not_found' });
    const removal = await this.rateRemoval(id);
    if (!removal.allowed) return ruleError(removal.reason);
    const result = await this.content.deleteEntry('rate', id, expectedVersion);
    if (!result.ok) return fail({ kind: 'conflict', currentVersion: result.currentVersion });
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
    if (parentId === ownId) return 'An add-on cannot be offered inside itself.';
    const parent = addOns.find((addOn) => addOn.id === parentId);
    if (!parent) return 'Pick an existing add-on to offer it inside.';
    if (parent.parentId) return 'That add-on is itself an extra — extras only go one level deep.';
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
      enabled: input.enabled ?? true,
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
      return ruleError('This add-on has extras of its own, so it cannot also be offered inside another. Extras only go one level deep.', 'parentId');
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
      enabled: input.enabled ?? current.enabled,
    } satisfies AddOn);

    const result = await this.content.upsertEntry({ kind: 'addon', id, hotelId: hotel.id, data: next, expectedVersion });
    if (!result.ok) return fail({ kind: 'conflict', currentVersion: result.currentVersion });
    return ok({ version: result.version });
  }

  /**
   * The quick on/off switch shared by the add-on list and an add-on's own page — no version field
   * on that control, so this reads the current version itself and retries once if a concurrent
   * edit landed in between. It returns the version it stepped from, so the form on the same page
   * can step along with it.
   */
  async setAddOnEnabled(id: string, enabled: boolean): Promise<ContentResult<Versioned & { previousVersion: number }>> {
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
      if (result.ok) return ok({ version: result.version, previousVersion: version });
    }
    return fail({ kind: 'conflict', currentVersion: await this.versionOf('addon', id) });
  }

  async addOnRemoval(id: string): Promise<Removal> {
    const current = await this.getAddOnContent(id);
    if (!current) return { allowed: false, reason: 'This add-on no longer exists.' };
    if (this.isSeed('addon', id)) {
      return { allowed: false, reason: 'Came with the demo catalog — withdraw it from sale instead of removing it.' };
    }
    if (await this.referencedByBooking('addon', id)) {
      return { allowed: false, reason: 'A booking includes it — withdraw it from sale instead.' };
    }
    const hotel = await this.hotel();
    const addOns = await this.repository.listAddOns(hotel.id);
    if (addOns.some((addOn) => addOn.parentId === id)) {
      return { allowed: false, reason: 'Remove the extras offered inside it first.' };
    }
    return { allowed: true };
  }

  async deleteAddOn(id: string, expectedVersion: number): Promise<ContentResult<null>> {
    assertCanEditContent();
    const current = await this.getAddOnContent(id);
    if (!current) return fail({ kind: 'not_found' });
    const removal = await this.addOnRemoval(id);
    if (!removal.allowed) return ruleError(removal.reason);
    const result = await this.content.deleteEntry('addon', id, expectedVersion);
    if (!result.ok) return fail({ kind: 'conflict', currentVersion: result.currentVersion });
    return ok(null);
  }

  // ----------------------------------------------------------------- Reset

  async resetContent(): Promise<void> {
    assertCanEditContent();
    const hotel = await this.hotel();
    await this.content.reset(hotel.id);
  }
}
