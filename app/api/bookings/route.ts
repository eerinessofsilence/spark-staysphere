import { BookingError } from '@/lib/application/booking-service';
import { bookingRequestBodySchema, confirmForSlug } from '@/lib/application/booking-intake';
import { HotelNotFoundError, RoomNotFoundError } from '@/lib/application/catalog-service';

const statusByCode: Record<string, number> = {
  invalid_request: 400,
  unavailable: 409,
  price_changed: 409,
  payment_declined: 402,
  not_found: 404,
};

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

  const body = await request.json().catch(() => null);
  const parsed = bookingRequestBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'invalid_request', message: 'The booking request is not valid.' },
      { status: 400 },
    );
  }

  try {
    const booking = await confirmForSlug(parsed.data, idempotencyKey);
    return Response.json({ booking }, { status: 201 });
  } catch (error) {
    if (error instanceof RoomNotFoundError || error instanceof HotelNotFoundError) {
      return Response.json({ error: 'not_found', message: error.message }, { status: 404 });
    }
    if (error instanceof BookingError) {
      return Response.json(
        {
          error: error.code,
          message: error.message,
          currentTotal: error.details?.currentTotal,
          fieldErrors: error.details?.fieldErrors,
        },
        { status: statusByCode[error.code] ?? 400 },
      );
    }
    console.error('Booking failed', error);
    return Response.json(
      { error: 'internal', message: 'Could not create that demo booking.' },
      { status: 500 },
    );
  }
}
