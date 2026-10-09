import { AdminAuthError, AdminPermissionError, requirePermission } from '@/lib/application/admin-session';
import { catalogService, guestDocumentService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-origin', Vary: 'Cookie' };
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    await requirePermission('team.permViewBookings');
    const hotel = await catalogService.getHotel(await getSelectedHotelSlug());
    const image = await guestDocumentService.readImage(hotel.id, (await params).id);
    if (!image) return new Response('Not found', { status: 404, headers });
    return new Response(image.body, { headers: { ...headers, 'Content-Type': image.contentType } });
  } catch (error) {
    if (error instanceof AdminAuthError) return new Response('Sign in required', { status: 401, headers });
    if (error instanceof AdminPermissionError) return new Response('Forbidden', { status: 403, headers });
    console.error('Guest document image request failed', {
      route: new URL(request.url).pathname,
      code: 'document_storage_unavailable',
      requestId,
    }, error);
    return Response.json({ error: 'unavailable', requestId }, { status: 503, headers });
  }
}
