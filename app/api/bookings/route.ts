import { bookingRequestBodySchema, confirmForSlug } from '@/lib/application/booking-intake';
import { parseJsonBody, toBookingErrorResponse } from '../_lib/http';

/**
 * POST /api/bookings — requires an `Idempotency-Key` header. Replaying the same
 * key returns the original booking instead of creating or charging a second one.
 */
export async function POST(request: Request): Promise<Response> {
  const idempotencyKey = request.headers.get('Idempotency-Key');
  if (!idempotencyKey || idempotencyKey.length < 8) {
    return Response.json(
      {
        error: 'invalid_request',
        message: 'An Idempotency-Key header of at least 8 characters is required.',
      },
      { status: 400 },
    );
  }

  const parsed = await parseJsonBody(request, bookingRequestBodySchema, 'The booking request is not valid.');
  if (!parsed.ok) return parsed.response;

  try {
    const booking = await confirmForSlug(parsed.data, idempotencyKey);
    return Response.json({ booking }, { status: 201 });
  } catch (error) {
    return toBookingErrorResponse(error, 'Booking failed', 'Could not create that demo booking.');
  }
}
