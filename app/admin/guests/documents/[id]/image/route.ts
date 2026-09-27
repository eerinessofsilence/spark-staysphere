import { requirePermission } from '@/lib/application/admin-session';
import { catalogService, guestDocumentService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-origin', Vary: 'Cookie' };
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('team.permViewBookings');
    const hotel = await catalogService.getHotel(await getSelectedHotelSlug());
    const image = await guestDocumentService.readImage(hotel.id, (await params).id);
    if (!image) return new Response('Not found', { status: 404, headers });
    return new Response(image.body, { headers: { ...headers, 'Content-Type': image.contentType } });
  } catch { return new Response('Document unavailable', { status: 403, headers }); }
}
