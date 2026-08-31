import { z } from 'zod';

export const currencySchema = z.enum(['EUR', 'USD', 'GBP']);
export const roomStatusSchema = z.enum(['available', 'last_room', 'limited', 'sold_out']);

export const hotelSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  tagline: z.string(),
  location: z.string(),
  currency: currencySchema,
  timezone: z.string(),
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
  media: z.array(z.object({ type: z.enum(['image', '360', 'gltf']), url: z.string() })),
});

export const ratePlanSchema = z.object({
  id: z.string(),
  roomTypeId: z.string(),
  name: z.string(),
  nightlyPrice: z.number().nonnegative(),
  currency: currencySchema,
  breakfastIncluded: z.boolean(),
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

export type Hotel = z.infer<typeof hotelSchema>;
export type RoomType = z.infer<typeof roomTypeSchema>;
export type RatePlan = z.infer<typeof ratePlanSchema>;
export type Availability = z.infer<typeof availabilitySchema>;
export type AddOn = z.infer<typeof addOnSchema>;
export type Guest = z.infer<typeof guestSchema>;
export type PaymentAttempt = z.infer<typeof paymentAttemptSchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type IntegrationStatus = z.infer<typeof integrationStatusSchema>;
