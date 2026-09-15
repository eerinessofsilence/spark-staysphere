import { BookingError } from './booking-service';
import { bookingService, catalogService, DEMO_HOTEL_SLUG, inventoryService } from './container';
import {
  paymentMethodSchema,
  ROOM_NUMBER,
  stayCriteriaFieldsSchema,
  stayCriteriaSchema,
} from '../domain/schemas';
import type { Booking, Quote, StayCriteria } from '../domain/schemas';
import { z } from 'zod';

/**
 * Slug-addressed intake shared by the booking UI's server actions and the HTTP
 * route handlers. Both entry points resolve the room, re-derive the price, and
 * hand a fully-typed request to BookingService — neither trusts a client total.
 */

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
  /** Defaulted, not required: `POST /api/bookings` shipped before this field. */
  paymentMethod: paymentMethodSchema.default('card'),
  unitNumber: z.string().regex(ROOM_NUMBER).optional(),
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

  // A replayed key already holds its room; checking again would find it taken by itself.
  if (body.unitNumber && !(await bookingService.findByIdempotencyKey(idempotencyKey))) {
    const free = await inventoryService.isUnitFreeForStay(
      DEMO_HOTEL_SLUG,
      detail.offer.room.id,
      body.unitNumber,
      criteria.checkIn,
      criteria.checkOut,
    );
    if (!free) {
      throw new BookingError(
        'unavailable',
        `Room ${body.unitNumber} is no longer free for those dates. Pick another room on the floor plan, or book this room type without choosing one.`,
      );
    }
  }

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
    paymentMethod: body.paymentMethod,
    unitNumber: body.unitNumber,
  });
}
