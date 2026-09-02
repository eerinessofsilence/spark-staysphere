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
  hotspots: z.array(hotspotSchema),
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
