import { z } from 'zod';
import { bookingService, DEMO_HOTEL_SLUG, sampleBookingService } from '@/lib/application/container';
import { createBookingConfirmationAccessToken, verifyBookingConfirmationAccessToken } from '@/lib/application/admin-session';
import { checkRateLimit, clientKeyFromHeaders } from '@/lib/application/assistant-rate-limit';
import { BOOKING_REFERENCE_PATTERN } from '@/lib/domain/booking';

const requestSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('list'),
    entries: z.array(z.object({
      reference: z.string().regex(BOOKING_REFERENCE_PATTERN),
      token: z.string().min(1),
    })).max(40),
  }),
  z.object({
    operation: z.literal('claim'),
    reference: z.string().regex(BOOKING_REFERENCE_PATTERN),
    email: z.string().email(),
  }),
  z.object({
    operation: z.literal('cancel'),
    reference: z.string().regex(BOOKING_REFERENCE_PATTERN),
    email: z.string().email(),
  }),
]);

/** Mutating or personal trip operations require both the reference and booking email. */
export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'invalid_request', message: 'The trips request is not valid.' }, { status: 400 });
  }

  const input = parsed.data;
  if (input.operation !== 'list' && !checkRateLimit(clientKeyFromHeaders(request.headers), 'bookingLookup')) {
    return Response.json({ error: 'rate_limited', message: 'Too many lookup attempts. Try again shortly.' }, { status: 429 });
  }
  try {
    if (input.operation === 'list') {
      const authorized = await Promise.all(input.entries.map(async ({ reference, token }) =>
        await verifyBookingConfirmationAccessToken(reference, token) ? reference : null,
      ));
      return Response.json({ trips: await bookingService.listTrips(authorized.filter((reference): reference is string => reference !== null)) });
    }
    if (input.operation === 'claim') {
      const trip = await bookingService.findTrip(input.reference, input.email);
      if (!trip) {
        return Response.json({ error: 'not_found', message: 'No booking matches that reference and email.' }, { status: 404 });
      }
      return Response.json({ trip, confirmationAccessToken: await createBookingConfirmationAccessToken(trip.reference) });
    }

    return Response.json(await bookingService.cancelTrip(input.reference, input.email));
  } catch (error) {
    const requestId = crypto.randomUUID();
    console.error('Guest trips request failed', { operation: input.operation, requestId }, error);
    return Response.json({ error: 'unavailable', message: 'The trips service is temporarily unavailable.', requestId }, { status: 503 });
  }
}

/** Public, read-only set of synthetic trips prepared by a PMS administrator. */
export async function GET(): Promise<Response> {
  try {
    const bookings = await sampleBookingService.listShowcase(DEMO_HOTEL_SLUG);
    const trips = await bookingService.listTrips(bookings.map((booking) => booking.reference));
    const confirmationAccess = await Promise.all(trips.map(async ({ reference }) => ({
      reference,
      token: await createBookingConfirmationAccessToken(reference),
    })));
    return Response.json({ trips, confirmationAccess }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const requestId = crypto.randomUUID();
    console.error('Guest showcase request failed', { requestId }, error);
    return Response.json({ error: 'unavailable', message: 'The trips service is temporarily unavailable.', requestId }, { status: 503 });
  }
}
