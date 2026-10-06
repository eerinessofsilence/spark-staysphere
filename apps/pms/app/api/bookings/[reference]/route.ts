import { BookingError } from '@/lib/application/booking-service';
import { bookingService } from '@/lib/application/container';
import { matchesGuestEmail } from '@/lib/domain/booking';
import { beginRequest, checkRateLimit, clientKeyFromHeaders, endRequest } from '@/lib/application/assistant-rate-limit';
import { createBookingConfirmationAccessToken, writeBookingConfirmationAccess } from '@/lib/application/admin-session';

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
  const clientKey = clientKeyFromHeaders(request.headers);
  if (!checkRateLimit(clientKey, 'bookingLookup') || !beginRequest(clientKey)) {
    return Response.json({ error: 'rate_limited', message: 'Too many lookup attempts. Try again shortly.' }, { status: 429 });
  }
  const notFound = () =>
    Response.json({ error: 'not_found', message: `No booking found for ${reference}.` }, { status: 404 });

  try {
    if (!email) return notFound();
    const booking = await bookingService.getByReference(reference);
    if (!matchesGuestEmail(booking.guest.email, email)) return notFound();
    // A successful guest-email check can reclaim the confirmation on a new
    // browser, without making the short reference itself an access token.
    await writeBookingConfirmationAccess(reference);
    return Response.json({ booking, confirmationAccessToken: await createBookingConfirmationAccessToken(reference) });
  } catch (error) {
    if (error instanceof BookingError && error.code === 'not_found') return notFound();
    const requestId = crypto.randomUUID();
    console.error('Guest booking lookup failed', { route: '/api/bookings/[reference]', code: 'service_unavailable', requestId }, error);
    return Response.json({ error: 'unavailable', message: 'The booking is temporarily unavailable.', requestId }, { status: 503 });
  } finally {
    endRequest(clientKey);
  }
}
