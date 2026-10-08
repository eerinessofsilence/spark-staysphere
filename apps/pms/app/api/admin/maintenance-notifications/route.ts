import { availableHotels, catalogService, maintenanceIssueService, teamService } from '@/lib/application/container';
import { AdminAuthError, requireAdminSession } from '@/lib/application/admin-session';
import { getAdminT } from '@/lib/i18n/admin/server';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireAdminSession();
    const member = await teamService.findMemberById(session.memberId);
    if (!member || member.role !== 'Hotelier') return Response.json({ error: 'forbidden' }, { status: 403 });
    const t = await getAdminT();
    const requested = new URL(request.url).searchParams.get('hotel');
    const hotels = availableHotels.filter((hotel) => member.hotelIds?.includes(hotel.id) && (!requested || requested === 'all' || hotel.slug === requested));
    if (requested && requested !== 'all' && !availableHotels.some((hotel) => hotel.slug === requested)) return Response.json({ error: 'invalid_hotel' }, { status: 400 });
    const notifications = (await Promise.all(hotels.map(async (option) => {
      const hotel = await catalogService.getHotel(option.slug);
      if (!(await maintenanceIssueService.canManageHotel(member, hotel.id))) return [];
      return (await maintenanceIssueService.listNotifications(hotel.id, member)).map((notification) => ({
        id: notification.id, issueId: notification.issueId,
        title: notification.title === 'Replacement Approval Required' ? t('maintenance.replacementNotification') : notification.title,
        message: notification.message,
        createdAt: notification.createdAt, readAt: notification.readAt,
        href: `/admin/maintenance/${encodeURIComponent(notification.issueId)}?hotel=${encodeURIComponent(option.slug)}`,
      }));
    }))).flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);
    return Response.json({ notifications }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AdminAuthError) return Response.json({ error: 'unauthorized' }, { status: 401 });
    console.error('Maintenance notification poll failed', error);
    return Response.json({ error: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
