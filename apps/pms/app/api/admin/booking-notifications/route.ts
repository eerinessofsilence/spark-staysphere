import { availableHotels, catalogService, hotelRepository } from '@/lib/application/container';
import { AdminAuthError, AdminPermissionError, requirePermission } from '@/lib/application/admin-session';

/** Short-poll target for the signed-in desk; only returns a small, selected-hotel preview. */
export async function GET(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    await requirePermission('team.permViewBookings');
    const hotelSlug = new URL(request.url).searchParams.get('hotel');
    if (!hotelSlug || !availableHotels.some((item) => item.slug === hotelSlug)) {
      return Response.json({ error: 'invalid_hotel' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    const hotel = await catalogService.getHotel(hotelSlug);
    const bookings = await hotelRepository.listBookings({ hotelId: hotel.id, limit: 50 });
    return Response.json({ bookings: bookings.map((booking) => ({
      reference: booking.reference,
      guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
      createdAt: booking.createdAt,
    })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AdminAuthError) return Response.json({ error: 'unauthorized' }, { status: 401 });
    if (error instanceof AdminPermissionError) return Response.json({ error: 'forbidden' }, { status: 403 });
    console.error('Booking notification poll failed', { route: '/api/admin/booking-notifications', code: 'internal_error', requestId }, error);
    return Response.json({ error: 'unavailable', requestId }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
