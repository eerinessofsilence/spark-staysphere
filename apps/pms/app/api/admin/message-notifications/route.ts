import { availableHotels, communicationsService } from '@/lib/application/container';
import { AdminAuthError, AdminPermissionError, requirePermission } from '@/lib/application/admin-session';

/** Unread guest messages for the selected property, polled by the signed-in desk. */
export async function GET(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    await requirePermission('team.permViewBookings');
    const hotelSlug = new URL(request.url).searchParams.get('hotel');
    if (!hotelSlug || !availableHotels.some((hotel) => hotel.slug === hotelSlug)) {
      return Response.json({ error: 'invalid_hotel' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    const conversations = await communicationsService.listConversations(hotelSlug, 50);
    const unreadCount = await communicationsService.countUnreadConversations(hotelSlug);
    return Response.json({
      unreadCount,
      conversations: conversations.filter((conversation) => conversation.unread > 0).map((conversation) => ({
        id: conversation.id,
        guestName: conversation.guestName,
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        unread: conversation.unread,
      })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AdminAuthError) return Response.json({ error: 'unauthorized' }, { status: 401 });
    if (error instanceof AdminPermissionError) return Response.json({ error: 'forbidden' }, { status: 403 });
    console.error('Message notification poll failed', { route: '/api/admin/message-notifications', code: 'internal_error', requestId }, error);
    return Response.json({ error: 'unavailable', requestId }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
