import { availableHotels, catalogService, listRateChanges } from '@/lib/application/container';
import { AdminAuthError, AdminPermissionError, requirePermission } from '@/lib/application/admin-session';

export async function GET(request: Request): Promise<Response> {
  try {
    await requirePermission('team.permEditRates');
    const slug = new URL(request.url).searchParams.get('hotel');
    if (!slug || !availableHotels.some((hotel) => hotel.slug === slug)) return Response.json({ error: 'invalid_hotel' }, { status: 400 });
    const hotel = await catalogService.getHotel(slug);
    return Response.json({ changes: await listRateChanges(hotel.id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AdminAuthError) return Response.json({ error: 'unauthorized' }, { status: 401 });
    if (error instanceof AdminPermissionError) return Response.json({ error: 'forbidden' }, { status: 403 });
    return Response.json({ error: 'unavailable' }, { status: 503 });
  }
}
