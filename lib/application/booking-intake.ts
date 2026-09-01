import { BookingError } from './booking-service';
import { bookingService, catalogService, DEMO_HOTEL_SLUG } from './container';
import { stayCriteriaSchema } from '../domain/schemas';
import type { Booking, Quote, StayCriteria } from '../domain/schemas';
import { z } from 'zod';

/**
 * Slug-addressed intake shared by the booking UI's server actions and the HTTP
 * route handlers. Both entry points resolve the room, re-derive the price, and
 * hand a fully-typed request to BookingService — neither trusts a client total.
 */

export const quoteRequestBodySchema = z.object({
  roomSlug: z.string().min(1),
  checkIn: z.string().date(),
  checkOut: z.string().date(),
  adults: z.number().int().min(1).max(8),
  children: z.number().int().min(0).max(6),
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
});

export type QuoteRequestBody = z.infer<typeof quoteRequestBodySchema>;
export type BookingRequestBody = z.infer<typeof bookingRequestBodySchema>;

function criteriaOf(body: QuoteRequestBody): StayCriteria {
  const parsed = stayCriteriaSchema.safeParse({
    checkIn: body.checkIn,
    checkOut: body.checkOut,
    adults: body.adults,
    children: body.children,
  });
  if (!parsed.success) {
    throw new BookingError('invalid_request', 'Check-out must be after check-in.');
  }
  return parsed.data;
}

export async function quoteForSlug(body: QuoteRequestBody): Promise<Quote> {
  const detail = await catalogService.getRoomDetail(
    DEMO_HOTEL_SLUG,
    body.roomSlug,
    criteriaOf(body),
    body.addOnIds,
  );
  return detail.quote;
}

export async function confirmForSlug(
  body: BookingRequestBody,
  idempotencyKey: string,
): Promise<Booking> {
  const criteria = criteriaOf(body);
  const hotel = await catalogService.getHotel(DEMO_HOTEL_SLUG);
  const detail = await catalogService.getRoomDetail(
    DEMO_HOTEL_SLUG,
    body.roomSlug,
    criteria,
    body.addOnIds,
  );

  return bookingService.confirm({
    idempotencyKey,
    hotelId: hotel.id,
    roomTypeId: detail.offer.room.id,
    ratePlanId: detail.offer.ratePlan.id,
    checkIn: criteria.checkIn,
    checkOut: criteria.checkOut,
    adults: criteria.adults,
    children: criteria.children,
    guest: body.guest,
    addOnIds: detail.quote.addOnIds,
    expectedTotal: body.expectedTotal,
  });
}
