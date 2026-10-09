import { cookies } from 'next/headers';
import { forwardPmsRequest } from '@/lib/application/pms-api';

/**
 * GET /api/bookings/:reference?email=… — compatibility proxy to PMS.
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
  if (!email) return Response.json({ error: 'not_found', message: 'No booking found for that reference.' }, { status: 404 });
  const headers = new Headers();
  const clientIp = request.headers.get('cf-connecting-ip');
  if (clientIp) headers.set('cf-connecting-ip', clientIp);
  const upstream = await forwardPmsRequest(
    `/api/bookings/${encodeURIComponent(reference)}?email=${encodeURIComponent(email)}`,
    { method: 'GET', headers },
  );
  const payload = await upstream.json().catch(() => null) as { booking?: { reference?: string }; confirmationAccessToken?: string } | null;
  if (upstream.ok && payload?.booking?.reference && payload.confirmationAccessToken) {
    const store = await cookies();
    store.set(`pms-booking-access-${payload.booking.reference}`, payload.confirmationAccessToken, {
      path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 30,
    });
  }
  return Response.json(payload && 'booking' in payload ? { booking: payload.booking } : payload, { status: upstream.status });
}
