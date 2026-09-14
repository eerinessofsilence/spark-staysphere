import { BookingError } from '@/lib/application/booking-service';
import { bookingService } from '@/lib/application/container';
import { matchesGuestEmail } from '@/lib/domain/booking';

/**
 * GET /api/bookings/:reference?email=… — a booking from the current process.
 *
 * The reference alone does not open it: `email` must match the guest's own,
 * the same rule `BookingService.findTrip`/`cancelTrip` already enforce for
 * the guest-facing "My trips" lookup. A reference is six characters from a
 * 28-letter alphabet, guessable in bulk, and would otherwise hand out the
 * guest's name, email and phone to anyone who tried enough of them. A wrong
 * email and a reference that was never issued fail identically, so the
 * failure itself never says which references exist.
 */
export async function GET(
  request: Request,
  context: RouteContext<'/api/bookings/[reference]'>,
): Promise<Response> {
  const { reference } = await context.params;
  const email = new URL(request.url).searchParams.get('email');
  const notFound = () =>
    Response.json({ error: 'not_found', message: `No booking found for ${reference}.` }, { status: 404 });

  if (!email) return notFound();

  try {
    const booking = await bookingService.getByReference(reference);
    if (!matchesGuestEmail(booking.guest.email, email)) return notFound();
    return Response.json({ booking });
  } catch (error) {
    if (error instanceof BookingError && error.code === 'not_found') return notFound();
    throw error;
  }
}
