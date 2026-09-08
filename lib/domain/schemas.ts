import { z } from 'zod';

export const currencySchema = z.enum(['EUR', 'USD', 'GBP']);
export const roomStatusSchema = z.enum(['available', 'last_room', 'limited', 'sold_out']);

/** A photograph the UI can place with confidence: dimensions are needed for hotspot maths. */
export const photoSchema = z.object({
  url: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string(),
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
 * Where a spinner hotspot sits at one frame it's actually visible in. A
 * hotspot only appears across the sub-range its keyframes span — the frames
 * where it faces the camera — with its position interpolated between them.
 */
export const spinnerHotspotKeyframeSchema = z.object({
  frameIndex: z.number().int().nonnegative(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  /**
   * The part of the building this marker stands for, traced on this frame as
   * fractions. Every keyframe of one hotspot must trace the same corners in the
   * same order, so the shape can be interpolated between frames as it turns.
   */
  outline: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })).optional(),
});

export const spinnerHotspotSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  /** The room type this marker sells, so it can carry the floor and tonight's price. */
  roomSlug: z.string().nullable(),
  href: z.string(),
  cta: z.string(),
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
  frames: z.array(spinnerFrameSchema),
  hotspots: z.array(spinnerHotspotSchema),
});

export const hotelSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  location: z.string(),
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
  photos: z
    .array(
      z.object({
        url: z.string(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      }),
    )
    .optional(),
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
  total: z.number().nonnegative(),
  currency: currencySchema,
  status: z.enum(['draft', 'held', 'confirmed', 'cancelled']),
  createdAt: z.string().datetime(),
});

export const integrationStatusSchema = z.object({
  adapter: z.enum(['pms', 'channel_manager', 'booking_engine', 'payment', 'crm']),
  mode: z.enum(['mock', 'sandbox', 'production']),
  connected: z.boolean(),
  lastSyncAt: z.string().datetime().nullable(),
});

/** What the guest is shopping for. Every price in the app is derived from this. */
export const stayCriteriaSchema = z
  .object({
    checkIn: z.string().date(),
    checkOut: z.string().date(),
    adults: z.number().int().min(1).max(8),
    children: z.number().int().min(0).max(6),
  })
  .refine((value) => value.checkOut > value.checkIn, {
    message: 'Check-out must be after check-in.',
    path: ['checkOut'],
  });

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
  /** Total shown to the guest at review time; confirmation fails if it drifted. */
  expectedTotal: z.number().nonnegative(),
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
export type IntegrationStatus = z.infer<typeof integrationStatusSchema>;
export type RoomStatus = z.infer<typeof roomStatusSchema>;
export type Currency = z.infer<typeof currencySchema>;
export type StayCriteria = z.infer<typeof stayCriteriaSchema>;
export type AddOnLine = z.infer<typeof addOnLineSchema>;
export type PriceBreakdown = z.infer<typeof priceBreakdownSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type RoomOffer = z.infer<typeof roomOfferSchema>;
export type BookingRequest = z.infer<typeof bookingRequestSchema>;
