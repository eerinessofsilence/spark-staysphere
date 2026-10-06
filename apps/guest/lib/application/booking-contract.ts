import { z } from 'zod';
import { paymentMethodSchema, ROOM_NUMBER, stayCriteriaFieldsSchema } from '../domain/schemas';

export const quoteRequestBodySchema = z.object({
  roomSlug: z.string().min(1),
  checkIn: stayCriteriaFieldsSchema.shape.checkIn,
  checkOut: stayCriteriaFieldsSchema.shape.checkOut,
  adults: stayCriteriaFieldsSchema.shape.adults,
  children: stayCriteriaFieldsSchema.shape.children,
  addOnIds: z.array(z.string()).default([]),
});

export const bookingRequestBodySchema = quoteRequestBodySchema.extend({
  guest: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(7),
  }),
  expectedTotal: z.number().nonnegative(),
  paymentMethod: paymentMethodSchema.default('card'),
  unitNumber: z.string().regex(ROOM_NUMBER).optional(),
});

export type QuoteRequestBody = z.infer<typeof quoteRequestBodySchema>;
export type BookingRequestBody = z.infer<typeof bookingRequestBodySchema>;
