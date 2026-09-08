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

/**
 * One stack of floors in the property's massing. A hotel is a handful of
 * these — a tower, a terraced front, a low wing — and the 3D model builds
 * itself from them, so any property can be described without a modeller.
 * Metres on the ground plane: x runs east, z runs south, toward the camera's
 * opening view. Floor 1 is the ground floor.
 */
export const buildingBlockSchema = z.object({
  id: z.string(),
  x: z.number(),
  z: z.number(),
  width: z.number().positive(),
  depth: z.number().positive(),
  fromFloor: z.number().int().min(1),
  toFloor: z.number().int().min(1),
  /**
   * Bends the block along an arc, as how far its middle bows forward of its
   * ends in metres. `width` stays the length measured along the bend, so a
   * bowed block is described the way a straight one is. The model builds the
   * bend as a run of straight bays, which is how such a facade is built.
   */
  bow: z.number().positive().optional(),
  /** Faces that carry a balcony on every floor; the south face by default. */
  balconies: z.array(z.enum(['front', 'back', 'left', 'right'])).optional(),
  /** Floors drawn fully glazed — a lobby at the base, a restaurant on top. */
  glazedFloors: z.array(z.number().int().min(1)).optional(),
  /** The roof is a terrace: a parapet instead of a plain slab. */
  roofTerrace: z.boolean().optional(),
});

/**
 * The property as a turnable model. Either a real GLB the property owns
 * (`url`), or the massing above, built on the fly. In a GLB, a mesh named
 * `floor-3` is picked as the third floor; nothing else is required of it.
 */
export const hotelModelSchema = z.object({
  url: z.string().optional(),
  /** Floor-to-floor height in metres. 3.4 when omitted. */
  floorHeight: z.number().positive().optional(),
  blocks: z.array(buildingBlockSchema),
  /** The ground the blocks stand on: a plinth, a pool, the sea to the south. */
  grounds: z
    .object({
      width: z.number().positive(),
      depth: z.number().positive(),
      /** How far the plinth stands above the sea; a cliff when it is tall. */
      height: z.number().positive().optional(),
      pool: z
        .object({
          x: z.number(),
          z: z.number(),
          width: z.number().positive(),
          depth: z.number().positive(),
        })
        .optional(),
      sea: z.boolean().optional(),
    })
    .optional(),
  /** The opening camera, in degrees around and above the building. */
  view: z
    .object({
      azimuth: z.number(),
      elevation: z.number(),
      distance: z.number().positive().optional(),
    })
    .optional(),
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
  /** The building as a model a guest can turn; absent until the property describes it. */
  model: hotelModelSchema.optional(),
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
  /** Total shown to the guest at review time; confirmation fails if it drifted. */
  expectedTotal: z.number().nonnegative(),
  paymentMethod: paymentMethodSchema,
});

export type Hotel = z.infer<typeof hotelSchema>;
export type HotelArea = z.infer<typeof hotelAreaSchema>;
export type HotelModel = z.infer<typeof hotelModelSchema>;
export type BuildingBlock = z.infer<typeof buildingBlockSchema>;
export type Hotspot = z.infer<typeof hotspotSchema>;
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
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type StayCriteria = z.infer<typeof stayCriteriaSchema>;
export type AddOnLine = z.infer<typeof addOnLineSchema>;
export type PriceBreakdown = z.infer<typeof priceBreakdownSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type RoomOffer = z.infer<typeof roomOfferSchema>;
export type BookingRequest = z.infer<typeof bookingRequestSchema>;
