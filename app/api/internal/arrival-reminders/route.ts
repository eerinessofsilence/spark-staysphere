import { addDays } from 'date-fns';
import { cronAuthorized, emailAutomationsService, hotelRepository } from '@/lib/application/container';
import { toIsoDate } from '@/lib/application/search-params';

export const dynamic = 'force-dynamic';

/** Daily: every confirmed, still-booked stay checking in tomorrow gets one reminder — see `EmailAutomationsService.sendArrivalReminders`. */
export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get('authorization'))) return new Response('Unauthorized', { status: 401 });
  try {
    const bookings = await hotelRepository.listBookings();
    const tomorrow = toIsoDate(addDays(new Date(), 1));
    const sent = await emailAutomationsService.sendArrivalReminders(bookings, tomorrow);
    return Response.json({ ok: true, sent }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
