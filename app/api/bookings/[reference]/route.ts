import { BookingError } from '@/lib/application/booking-service';
import { bookingService } from '@/lib/application/container';

/** GET /api/bookings/:reference — the demo booking created in this process. */
export async function GET(
  _request: Request,
  context: RouteContext<'/api/bookings/[reference]'>,
): Promise<Response> {
  const { reference } = await context.params;
  try {
    return Response.json({ booking: await bookingService.getByReference(reference) });
  } catch (error) {
    if (error instanceof BookingError && error.code === 'not_found') {
      return Response.json({ error: 'not_found', message: error.message }, { status: 404 });
    }
    throw error;
  }
}
