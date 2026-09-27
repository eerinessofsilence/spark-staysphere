import { z } from 'zod';
import { identitySchema } from './guest-document';

export const currencySchema = z.enum(['EUR', 'USD', 'GBP']);
export const roomStatusSchema = z.enum(['available', 'last_room', 'limited', 'sold_out']);

/** A photograph the UI can place with confidence: dimensions are needed for hotspot maths. */
export const photoSchema = z.object({
  url: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string(),
});

/**
 * A photograph with nothing riding on its exact pixels — no hotspot maths, no
 * licence-mandated alt text. What a dish's gallery and the hotel's own "about"
 * photo both are; `alt` is composed from context at render time instead of
 * being a field an editor has to remember to fill in.
 */
export const simplePhotoSchema = z.object({
  url: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const hotspotSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  /** Position as a fraction of the photo's width and height. */
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  /**
   * Where the same marker sits inside the area's 360° capture, in degrees.
   * Omitted, it is derived from `x`/`y`; a real capture sets them exactly.
   */
  yaw: z.number().min(-180).max(180).optional(),
  pitch: z.number().min(-90).max(90).optional(),
  /** The room type this marker sells, so it can carry the floor and tonight's price. */
  roomSlug: z.string().optional(),
  /** The part of the photo the marker stands for, as fractions; outlined on hover. */
  outline: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })).optional(),
  /** The same footprint inside the 360° capture, as corners in degrees; it turns with the view. */
  sphereOutline: z.array(z.object({ yaw: z.number(), pitch: z.number() })).optional(),
  /** Where the hotspot sends a guest; the stay query is appended at render time. */
  href: z.string(),
  cta: z.string(),
});

/** One explorable part of the property on the arrival screen. */
export const hotelAreaSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  photo: photoSchema,
  /** Equirectangular (2:1) capture of the same area, offered beside the photo. */
  panorama: z.string().optional(),
  /** Where the sphere opens, in degrees; an aerial looks down, a room looks level. */
  panoramaView: z.object({ yaw: z.number(), pitch: z.number(), hfov: z.number().optional() }).optional(),
  /** Shown on the sphere when its licence asks for a visible credit. */
  panoramaCredit: z.object({ text: z.string(), href: z.string() }).optional(),
  /**
   * Where each room type sits on the photo — a floor, a wing — as fractions.
   * Hovering one names the room, its floor and its price; clicking opens it.
   */
  roomZones: z
    .array(
      z.object({
        roomSlug: z.string(),
        outline: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })),
      }),
    )
    .optional(),
  hotspots: z.array(hotspotSchema),
});

/** One still in the orbit sequence; `frames[0]` is the 0° stop. */
export const spinnerFrameSchema = z.object({
  index: z.number().int().nonnegative(),
  imageUrl: z.string(),
});

/**
 * A fraction of the spinner frame, generous past both edges: `floorBand()`
 * (`mock-data.ts`) deliberately extrapolates a floor hotspot's position and
 * outline past the traced band's own edge for the storeys below it — "past
 * 1" is that band's own documented behaviour, not bad data. `[0, 1]` would
 * reject exactly the floors that behaviour exists for.
 */
const spinnerFraction = z.number().min(-1).max(2);

/**
 * Where a spinner hotspot sits at one frame it's actually visible in. A
 * hotspot only appears across the sub-range its keyframes span — the frames
 * where it faces the camera — with its position interpolated between them.
 */
export const spinnerHotspotKeyframeSchema = z.object({
  frameIndex: z.number().int().nonnegative(),
  x: spinnerFraction,
  y: spinnerFraction,
  /**
   * The part of the building this marker stands for, traced on this frame as
   * fractions. Every keyframe of one hotspot must trace the same corners in the
   * same order, so the shape can be interpolated between frames as it turns.
   */
  outline: z.array(z.object({ x: spinnerFraction, y: spinnerFraction })).optional(),
});

export const spinnerHotspotSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  /** The room type this marker sells, so it can carry the floor and tonight's price. */
  roomSlug: z.string().nullable(),
  href: z.string(),
  cta: z.string(),
  /**
   * A traced floor band rather than a pinned marker. The shape itself is what
   * the guest points at, so it carries no pill — eight of those stacked up the
   * facade would bury the building they are drawn on.
   */
  zone: z.boolean().optional(),
  keyframes: z.array(spinnerHotspotKeyframeSchema).min(2),
});

/** A draggable orbit around the building exterior — replaces one `HotelArea`'s flat photo. */
export const buildingSpinnerSchema = z.object({
  frameCount: z.number().int().positive(),
  /** Every frame shares one framing, so hotspot fractions project through one size. */
  frameWidth: z.number().int().positive(),
  frameHeight: z.number().int().positive(),
  /**
   * The frames the arrows stop on. Stepping 160 frames one at a time is
   * unusable, so prev/next jump to the next of these and animate the frames
   * in between.
   */
  keyAngles: z.array(z.number().int().nonnegative()).min(2),
  /**
   * The frame the orbit opens on when nothing in the URL says otherwise.
   * Optional so this ships without touching every existing fixture — falls
   * back to the lowest `keyAngles` value, as it always has (`openingFrame`
   * in `orbit.ts`).
   */
  startFrame: z.number().int().nonnegative().optional(),
  frames: z.array(spinnerFrameSchema),
  hotspots: z.array(spinnerHotspotSchema),
});

/**
 * The marks a hotel facility can wear — a fixed vocabulary rather than a free
 * icon name, so the CMS offers a grid to pick from and the guest site never
 * meets a key it has no drawing for. `components/hotel/facility-icon.ts`
 * maps each to its Phosphor glyph and label.
 */
export const facilityIconSchema = z.enum([
  'pool',
  'spa',
  'gym',
  'restaurant',
  'bar',
  'coffee',
  'wifi',
  'parking',
  'ev-charging',
  'shuttle',
  'taxi',
  'beach',
  'marina',
  'garden',
  'terrace',
  'concierge',
  'reception',
  'laundry',
  'kids',
  'pets',
  'accessible',
  'elevator',
  'air-conditioning',
  'safe',
  'security',
  'business',
  'library',
  'games',
  'cinema',
  'music',
  'bicycles',
  'tennis',
  'golf',
  'first-aid',
]);
export type FacilityIcon = z.infer<typeof facilityIconSchema>;

/** One thing the property offers as a whole — the pool, the spa — as opposed to a room's own amenities. */
export const hotelFacilitySchema = z.object({
  icon: facilityIconSchema,
  name: z.string(),
});
export type HotelFacility = z.infer<typeof hotelFacilitySchema>;

export const hotelSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  location: z.string(),
  starRating: z.number().int().min(1).max(5),
  /** The one paragraph on the arrival page introducing the property. */
  description: z.string(),
  /** The photograph beside that paragraph. */
  aboutPhoto: simplePhotoSchema,
  /** Ordered About gallery; older catalogs keep their single aboutPhoto as the cover. */
  aboutPhotos: z.array(simplePhotoSchema).min(1).max(30).optional(),
  /**
   * Shown on every room's page, in the order the hotel team set. Optional
   * for the same reason `spinner` and `model` are — an overlay row saved
   * before this field existed still parses — and read as an empty list.
   */
  facilities: z.array(hotelFacilitySchema).optional(),
  currency: currencySchema,
  timezone: z.string(),
  areas: z.array(hotelAreaSchema),
  /**
   * Optional so this ships without touching every existing `Hotel` fixture.
   * When present, it replaces the flat photo of whichever `HotelArea` carries
   * the same hotspot ids (see `SPINNER_AREA_ID` in `hotel-scene.tsx`).
   */
  spinner: buildingSpinnerSchema.optional(),
});

export const roomTypeSchema = z.object({
  id: z.string(),
  hotelId: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  areaM2: z.number().positive(),
  floor: z.number().int().nonnegative(),
  capacity: z.number().int().positive(),
  bedType: z.enum(['king', 'twin', 'queen']),
  view: z.enum(['sea', 'garden', 'pool', 'city']),
  amenities: z.array(z.string()),
  /**
   * Names from the hotel's own `facilities` list (Hotel Settings — the pool,
   * the spa) that this room type's own page shows, a subset rather than the
   * property's whole list. A reference by name, the loose join the CMS
   * already uses elsewhere rather than a new id scheme (facilities have
   * none). `undefined` — no selection ever made — reads as "every facility",
   * so this ships without touching every existing `RoomType` fixture and a
   * room created before this field existed keeps showing what it always
   * did; see `RoomDetailView`.
   */
  facilities: z.array(z.string()).optional(),
  /**
   * Withdrawn from the site by the CMS. Optional so this ships without
   * touching every existing `RoomType` fixture (the same trick as `spinner`
   * and `model` on `Hotel`). A hidden room stays visible in `/admin/content`
   * but is excluded everywhere a guest could reach it — see
   * `CatalogService.getHotel`/`search`/`getRoomDetail`.
   */
  hidden: z.boolean().optional(),
  media: z.array(
    z.object({
      type: z.enum(['image', '360', 'gltf']),
      url: z.string(),
      /** Shown as the gallery tab, e.g. "Bedroom" or "Terrace". */
      label: z.string().optional(),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
    }),
  ),
});

export const ratePlanSchema = z.object({
  id: z.string(),
  roomTypeId: z.string(),
  name: z.string(),
  nightlyPrice: z.number().nonnegative(),
  currency: currencySchema,
  breakfastIncluded: z.boolean(),
  includedServices: z.array(z.string()),
  cancellationPolicy: z.string(),
  otaComparisonPrice: z.number().nonnegative().optional(),
});

export const availabilitySchema = z.object({
  roomTypeId: z.string(),
  date: z.string().date(),
  remaining: z.number().int().nonnegative(),
  status: roomStatusSchema,
});

export const addOnSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  /**
   * Which counter the extra is sold from. Both are quoted and paid with the
   * stay; the split is what the guest is shown, since ordering dinner and
   * booking a transfer are different decisions made at different moments.
   */
  category: z.enum(['service', 'dining']),
  /**
   * An extra that belongs to another extra: the wine pairing on a dinner, the
   * return leg on a transfer. Modelling it as an add-on with a parent rather
   * than a new kind of record means the selection, the quote, the booking, and
   * every stored total keep working unchanged — it is priced, withdrawn, and
   * paid for exactly like the thing it hangs off. It is only ever offered
   * inside its parent, and is dropped from a quote if the parent is not taken.
   */
  parentId: z.string().optional(),
  /**
   * A dish is chosen by sight, so anything from the kitchen carries its own
   * photographs: the first is the card, the rest are the panel's slider.
   * Services have none and are shown by name and description.
   */
  photos: z.array(simplePhotoSchema).optional(),
  price: z.number().nonnegative(),
  currency: currencySchema,
  pricingUnit: z.enum(['per_stay', 'per_night', 'per_guest']),
  enabled: z.boolean(),
});

export const guestSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(7),
});

export const paymentAttemptSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  provider: z.string(),
  status: z.enum(['demo_pending', 'authorized', 'failed']),
  amount: z.number().nonnegative(),
  currency: currencySchema,
});

/** A floor then a two-digit position: `305`, or `G04` on the ground floor. */
export const ROOM_NUMBER = /^(?:G|[1-9]\d?)\d{2}$/;

/**
 * One door in the building. The catalog sells room types; these are what a
 * type's availability counts and what the floor plan and the front desk draw.
 */
export const physicalRoomSchema = z.object({
  id: z.string(),
  hotelId: z.string(),
  roomTypeId: z.string(),
  number: z.string().regex(ROOM_NUMBER),
  floor: z.number().int().nonnegative(),
});

export type PhysicalRoom = z.infer<typeof physicalRoomSchema>;

/** The desk's side of a confirmed stay — see `lib/domain/stay-state.ts` for the moves between them. */
export const stayStateSchema = z.enum(['booked', 'checked_in', 'checked_out', 'no_show']);

/**
 * Where one physical room stands with housekeeping — separate from its room
 * type's sell status (`roomStatusSchema`) and from any stay in it. See
 * `lib/domain/housekeeping.ts` for what each means and what a room defaults
 * to before anyone has touched it.
 */
export const housekeepingStatusSchema = z.enum(['clean', 'dirty', 'in_progress', 'inspected', 'out_of_order']);

export const bookingSchema = z.object({
  id: z.string(),
  reference: z.string(),
  idempotencyKey: z.string(),
  hotelId: z.string(),
  roomTypeId: z.string(),
  ratePlanId: z.string(),
  checkIn: z.string().date(),
  checkOut: z.string().date(),
  adults: z.number().int().positive(),
  children: z.number().int().nonnegative(),
  guest: guestSchema,
  addOnIds: z.array(z.string()),
  unitNumber: z.string().optional(),
  total: z.number().nonnegative(),
  currency: currencySchema,
  status: z.enum(['draft', 'held', 'confirmed', 'cancelled']),
  stayState: stayStateSchema.default('booked'),
  createdAt: z.string().datetime(),
  /** Set by the desk on `/admin/groups`, never by the guest flow — a shared reservation (a wedding block, a conference room list) this booking belongs to alongside others. */
  groupId: z.string().optional(),
});

/**
 * A shared reservation the desk creates on `/admin/groups` and attaches
 * existing bookings to — a wedding block, a conference's room list, a tour
 * operator's allotment. There is no group-level rate or inventory: it is a
 * label and a balance rolled up from the bookings attached to it
 * (`bookingSchema.groupId`), the same "derive from bookings" rule
 * `lib/application/guest-directory.ts` already applies to a guest.
 */
export const bookingGroupSchema = z.object({
  id: z.string(),
  hotelId: z.string(),
  name: z.string().min(1),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
});

/**
 * A guest record the desk creates on `/admin/guests` before there is any
 * booking to derive them from — someone who called ahead, a VIP the hotel
 * wants on file, a corporate contact. `lib/application/guest-directory.ts`
 * merges these with the guests derived from bookings, by email; a booking
 * made later under the same email is simply more history for the same row,
 * not a second guest.
 */
export const guestProfileSchema = z.object({
  id: z.string(),
  hotelId: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(7),
  createdAt: z.string().datetime(),
  identity: z.lazy(() => identitySchema).optional(),
});

export const integrationStatusSchema = z.object({
  adapter: z.enum(['pms', 'channel_manager', 'booking_engine', 'payment', 'crm']),
  mode: z.enum(['mock', 'sandbox', 'production']),
  connected: z.boolean(),
  lastSyncAt: z.string().datetime().nullable(),
});

/**
 * What a role can be granted — see `lib/application/team-directory.ts` for
 * the five built-in roles and `lib/application/team-service.ts` for how a
 * custom one (`TeamRoleDefinition`) is built and checked against the same
 * enum, so a role dreamed up in `/admin/settings/team` can never grant
 * something `requirePermission` doesn't know how to gate.
 */
export const teamPermissionKeySchema = z.enum([
  'team.permViewBookings',
  'team.permCancelBookings',
  'team.permEditRates',
  'team.permEditContent',
  'team.permManageMedia',
  'team.permBrandDomain',
  'team.permTeamRoles',
  'team.permIntegrations',
  'team.permHousekeeping',
]);

/**
 * A role a team member can be given: one of the five seeded ones
 * (`builtin: true`, editable but not removable) or one created from
 * `/admin/settings/team` (`builtin: false`, its `id` a slug of its name).
 */
export const teamRoleDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  builtin: z.boolean(),
  permissions: z.array(teamPermissionKeySchema),
});

/**
 * A stay longer than this both overruns `nightsInRange`'s own cap (silently
 * dropping availability checks and holds for the nights past it) and would
 * still be priced and charged in full by `nightsBetween`, which has no cap
 * of its own — see `lib/domain/availability.ts`.
 */
export const MAX_STAY_NIGHTS = 60;

/**
 * Party-size limits. One source: `stayCriteriaSchema` below is the canonical
 * shape, reused by `quoteRequestBodySchema`/`bookingRequestBodySchema`
 * (`booking-intake.ts`) and the assistant's search body schema, so a change
 * to how many guests a stay can hold is a change in one place. The numeric
 * constants exist for `search-params.ts`'s clamp functions, which clamp a
 * raw number rather than parse one through Zod.
 */
export const MIN_ADULTS = 1;
export const MAX_ADULTS = 8;
export const MIN_CHILDREN = 0;
export const MAX_CHILDREN = 6;

/**
 * The base shape, kept separate from the `.refine()` below (which wraps it in
 * a `ZodEffects` that no longer exposes `.shape`) so other schemas that need
 * these same fields — `quoteRequestBodySchema` in `booking-intake.ts`, the
 * assistant's search body — can reuse `stayCriteriaFieldsSchema.shape.adults`
 * etc. instead of retyping the same `.min().max()`.
 */
export const stayCriteriaFieldsSchema = z.object({
  checkIn: z.string().date(),
  checkOut: z.string().date(),
  adults: z.number().int().min(MIN_ADULTS).max(MAX_ADULTS),
  children: z.number().int().min(MIN_CHILDREN).max(MAX_CHILDREN),
});

/** What the guest is shopping for. Every price in the app is derived from this. */
export const stayCriteriaSchema = stayCriteriaFieldsSchema
  .refine((value) => value.checkOut > value.checkIn, {
    message: 'Check-out must be after check-in.',
    path: ['checkOut'],
  })
  .refine(
    (value) => {
      const nights = Math.round(
        (Date.parse(value.checkOut) - Date.parse(value.checkIn)) / 86_400_000,
      );
      return nights <= MAX_STAY_NIGHTS;
    },
    { message: `Stays are limited to ${MAX_STAY_NIGHTS} nights.`, path: ['checkOut'] },
  );

export const addOnLineSchema = z.object({
  addOnId: z.string(),
  /** Set when the line is an extra on another line, so a summary can indent it. */
  parentId: z.string().optional(),
  name: z.string(),
  pricingUnit: addOnSchema.shape.pricingUnit,
  unitPrice: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  total: z.number().nonnegative(),
});

export const priceBreakdownSchema = z.object({
  nights: z.number().int().positive(),
  nightlyPrice: z.number().nonnegative(),
  roomTotal: z.number().nonnegative(),
  addOnLines: z.array(addOnLineSchema),
  addOnsTotal: z.number().nonnegative(),
  taxesAndFees: z.number().nonnegative(),
  total: z.number().nonnegative(),
  currency: currencySchema,
  /** Demo-only comparison figure. Never sourced from a live OTA. */
  otaComparisonTotal: z.number().nonnegative().nullable(),
  directSaving: z.number().nonnegative(),
});

export const quoteSchema = z.object({
  roomTypeId: z.string(),
  ratePlanId: z.string(),
  checkIn: z.string().date(),
  checkOut: z.string().date(),
  adults: z.number().int().positive(),
  children: z.number().int().nonnegative(),
  addOnIds: z.array(z.string()),
  available: z.boolean(),
  status: roomStatusSchema,
  remaining: z.number().int().nonnegative(),
  price: priceBreakdownSchema,
  expiresAt: z.string().datetime(),
});

/** A room presented for sale: inventory, rate, and money already resolved. */
export const roomOfferSchema = z.object({
  room: roomTypeSchema,
  ratePlan: ratePlanSchema,
  status: roomStatusSchema,
  remaining: z.number().int().nonnegative(),
  price: priceBreakdownSchema,
});

/** Everything a caller must supply to create a booking. Server owns id/reference/total. */
/**
 * What the guest chose to pay with. Cards and the two wallets authorize at
 * booking time; a transfer and paying at the desk do not, which is why the
 * service treats them apart rather than pretending every method behaves the
 * same. Live collection is out of scope either way (see CLAUDE.md) — these
 * name the real flows a production build would hand to its provider.
 */
export const paymentMethodSchema = z.enum([
  'card',
  'apple_pay',
  'google_pay',
  'bank_transfer',
  'pay_at_hotel',
]);

export const bookingRequestSchema = z.object({
  idempotencyKey: z.string().min(8),
  hotelId: z.string(),
  roomTypeId: z.string(),
  ratePlanId: z.string(),
  checkIn: z.string().date(),
  checkOut: z.string().date(),
  adults: z.number().int().positive(),
  children: z.number().int().nonnegative(),
  guest: guestSchema,
  addOnIds: z.array(z.string()),
  /** A room picked on the floor plan; omitted, any room of the type. */
  unitNumber: z.string().optional(),
  /** Total shown to the guest at review time; confirmation fails if it drifted. */
  expectedTotal: z.number().nonnegative(),
  paymentMethod: paymentMethodSchema,
});

export type Hotel = z.infer<typeof hotelSchema>;
export type HotelArea = z.infer<typeof hotelAreaSchema>;
export type Hotspot = z.infer<typeof hotspotSchema>;
export type BuildingSpinnerData = z.infer<typeof buildingSpinnerSchema>;
export type SpinnerHotspot = z.infer<typeof spinnerHotspotSchema>;
export type SpinnerFrame = z.infer<typeof spinnerFrameSchema>;
export type Photo = z.infer<typeof photoSchema>;
export type RoomType = z.infer<typeof roomTypeSchema>;
export type RatePlan = z.infer<typeof ratePlanSchema>;
export type Availability = z.infer<typeof availabilitySchema>;
export type AddOn = z.infer<typeof addOnSchema>;
export type Guest = z.infer<typeof guestSchema>;
export type PaymentAttempt = z.infer<typeof paymentAttemptSchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type BookingGroup = z.infer<typeof bookingGroupSchema>;
export type GuestProfile = z.infer<typeof guestProfileSchema>;
export type StayState = z.infer<typeof stayStateSchema>;
export type HousekeepingStatus = z.infer<typeof housekeepingStatusSchema>;
export type IntegrationStatus = z.infer<typeof integrationStatusSchema>;
export type TeamPermissionKey = z.infer<typeof teamPermissionKeySchema>;
export type TeamRoleDefinition = z.infer<typeof teamRoleDefinitionSchema>;
export type RoomStatus = z.infer<typeof roomStatusSchema>;
export type Currency = z.infer<typeof currencySchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type StayCriteria = z.infer<typeof stayCriteriaSchema>;
export type AddOnLine = z.infer<typeof addOnLineSchema>;
export type PriceBreakdown = z.infer<typeof priceBreakdownSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type RoomOffer = z.infer<typeof roomOfferSchema>;
export type BookingRequest = z.infer<typeof bookingRequestSchema>;
