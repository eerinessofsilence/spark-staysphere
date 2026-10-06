import { z } from 'zod';
import { currencySchema } from './schemas';

/** The lifecycle a desk follows for an in-stay service order. */
export const orderStatusSchema = z.enum(['new', 'confirmed', 'in_progress', 'ready', 'completed', 'cancelled']);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const orderPaymentStatusSchema = z.enum(['paid', 'unpaid', 'partial']);
export type OrderPaymentStatus = z.infer<typeof orderPaymentStatusSchema>;

export const orderCategorySchema = z.enum(['dining', 'wellness', 'experience', 'transport', 'room']);
export type OrderCategory = z.infer<typeof orderCategorySchema>;

export const orderDeliverySchema = z.enum(['Without delivery', 'Room delivery', 'Hotel pickup']);
export type OrderDelivery = z.infer<typeof orderDeliverySchema>;

export const createHotelOrderInputSchema = z.object({
  guestName: z.string().trim().min(1).max(120),
  roomNumber: z.string().trim().max(20).optional(),
  serviceName: z.string().trim().min(1).max(120),
  category: orderCategorySchema,
  delivery: orderDeliverySchema,
  dueAt: z.string().datetime(),
  total: z.number().finite().nonnegative(),
  extras: z.number().int().nonnegative().max(99),
  paymentStatus: orderPaymentStatusSchema,
  status: orderStatusSchema,
  bookingReference: z.string().trim().max(80).optional(),
});
export type CreateHotelOrderInput = z.infer<typeof createHotelOrderInputSchema>;

/**
 * A hotel service order is deliberately separate from a room reservation.
 * The demo adapter below is replaceable with a PMS/channel-manager order
 * adapter without making the grid depend on a particular provider payload.
 */
export const hotelOrderSchema = z.object({
  id: z.string().min(1),
  hotelId: z.string().min(1),
  createdAt: z.string().datetime(),
  dueAt: z.string().datetime(),
  guestName: z.string().min(1),
  roomNumber: z.string().nullable(),
  serviceName: z.string().min(1),
  category: orderCategorySchema,
  delivery: z.string().min(1),
  chatCount: z.number().int().nonnegative(),
  total: z.number().nonnegative(),
  currency: currencySchema,
  extras: z.number().int().nonnegative(),
  paymentStatus: orderPaymentStatusSchema,
  status: orderStatusSchema,
  bookingReference: z.string().nullable(),
});

export type HotelOrder = z.infer<typeof hotelOrderSchema>;
