import { bookingService } from '@/lib/application/container';
import { verifyBookingConfirmationAccessToken } from '@/lib/application/admin-session';

/** GET /api/bookings/:reference/confirmation — requires the signed Guest access proof. */
export async function GET(
  request: Request,
  context: RouteContext<'/api/bookings/[reference]/confirmation'>,
): Promise<Response> {
  const { reference } = await context.params;
  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  if (!(await verifyBookingConfirmationAccessToken(reference, token))) {
    return Response.json({ error: 'not_found', message: 'No booking found for that reference.' }, { status: 404 });
  }

  try {
    return Response.json({ confirmation: await bookingService.getConfirmation(reference) });
  } catch (error) {
    const requestId = crypto.randomUUID();
    console.error('Guest booking confirmation failed', { reference, requestId }, error);
    return Response.json({ error: 'unavailable', message: 'The booking is temporarily unavailable.', requestId }, { status: 503 });
  }
}
