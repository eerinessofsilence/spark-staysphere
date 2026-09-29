import { cronAuthorized, hotelRepository } from '@/lib/application/container';
import { runScheduledAutomations } from '@/lib/application/scheduled-automations';

export const dynamic = 'force-dynamic';

/** Daily: every `before_check_in`/`after_check_out` automation, matched against every confirmed booking — see `EmailAutomationsService.sendScheduled`. */
export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get('authorization'))) return new Response('Unauthorized', { status: 401 });
  try {
    const sent = await runScheduledAutomations(hotelRepository);
    return Response.json({ ok: true, sent }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
