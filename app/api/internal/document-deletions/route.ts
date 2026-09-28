import { cronAuthorized, guestDocumentService } from '@/lib/application/container';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get('authorization'))) return new Response('Unauthorized', { status: 401 });
  try {
    await guestDocumentService.retryDeletions();
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ ok: false }, { status: 503 }); }
}
