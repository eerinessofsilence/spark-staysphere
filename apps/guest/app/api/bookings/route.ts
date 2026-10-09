import { cookies } from 'next/headers';
import { forwardPmsRequest } from '@/lib/application/pms-api';

/** Compatibility proxy. The booking and idempotency key are handled by PMS. */
export async function POST(request: Request): Promise<Response> {
  const upstream = await forwardPmsRequest('/api/bookings', {
    method: 'POST',
    headers: {
      'content-type': request.headers.get('content-type') ?? 'application/json',
      'Idempotency-Key': request.headers.get('Idempotency-Key') ?? '',
    },
    body: await request.text(),
  });
  const payload = await upstream.json().catch(() => null) as { booking?: { reference?: string }; confirmationAccessToken?: string } | null;
  if (upstream.ok && payload?.booking?.reference && payload.confirmationAccessToken) {
    const store = await cookies();
    store.set(`pms-booking-access-${payload.booking.reference}`, payload.confirmationAccessToken, {
      path: '/', httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 30,
    });
  }
  return Response.json(payload && 'booking' in payload ? { booking: payload.booking } : payload, { status: upstream.status });
}
