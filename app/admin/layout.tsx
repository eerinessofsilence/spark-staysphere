import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/application/admin-session';
import { availableHotels, catalogService, communicationsService, hotelRepository, teamService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { roleLabel } from '@/components/admin/settings/team-data';
import { AdminLocaleProvider } from '@/lib/i18n/admin/context';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminT } from '@/lib/i18n/admin/translate';
import { AdminShell } from '@/components/admin/shell/admin-shell';
import type { RecentBooking, UnreadConversation } from '@/components/admin/shell/notification-bell';
import { AdminServiceUnavailable } from '@/components/admin/shell/admin-service-unavailable';

export const dynamic = 'force-dynamic';

const RECENT_BOOKINGS_LIMIT = 8;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The gate in front of every screen. The door itself (`/admin/sign-in`,
  // `/admin/welcome`) lives in `app/(auth)/admin`, outside this layout, so
  // sending someone there never loops back through here. Server actions
  // check the same session themselves (`requireAdminSession`): a layout
  // only guards what renders, not what can be posted to.
  let session;
  try {
    session = await getAdminSession();
  } catch (error) {
    const requestId = crypto.randomUUID();
    console.error('Admin session lookup failed', { route: '/admin', code: 'service_unavailable', requestId }, error);
    return <AdminServiceUnavailable locale={await getAdminLocale()} />;
  }
  if (!session) redirect('/admin/sign-in');
  if (!session.onboarded) redirect('/admin/welcome');
  let member;
  try {
    member = await teamService.findMemberById(session.memberId);
  } catch (error) {
    const requestId = crypto.randomUUID();
    console.error('Admin member lookup failed', { route: '/admin', code: 'service_unavailable', requestId }, error);
    return <AdminServiceUnavailable locale={await getAdminLocale()} />;
  }
  if (!member) redirect('/admin/sign-in');
  if (member.role === 'Housekeeper') redirect('/housekeeper');

  const [selectedSlug, locale] = await Promise.all([getSelectedHotelSlug(), getAdminLocale()]);
  let hotel;
  let roles;
  try {
    [hotel, roles] = await Promise.all([catalogService.getHotel(selectedSlug), teamService.listRoles()]);
  } catch (error) {
    const requestId = crypto.randomUUID();
    console.error('Admin shell data lookup failed', { route: '/admin', code: 'service_unavailable', requestId }, error);
    return <AdminServiceUnavailable locale={locale} />;
  }
  // These queries only fill the shell's notification previews. Keep them out of
  // the critical path for every admin page, and let whichever summaries load
  // continue to work if a nonessential data source is temporarily unavailable.
  const summaries = await Promise.allSettled([
    hotelRepository.listBookings({ hotelId: hotel.id, limit: RECENT_BOOKINGS_LIMIT }),
    communicationsService.listConversations(selectedSlug, RECENT_BOOKINGS_LIMIT),
    communicationsService.countUnreadConversations(selectedSlug),
    hotelRepository.listRooms(hotel.id),
  ]);
  const summaryNames = ['recent bookings', 'conversations', 'unread count', 'rooms'] as const;
  summaries.forEach((result, index) => {
    if (result.status === 'rejected') {
      const requestId = crypto.randomUUID();
      console.error(`Admin ${summaryNames[index]} summary failed`, { route: '/admin', code: 'service_unavailable', requestId }, result.reason);
    }
  });
  const recentBookingsRaw = summaries[0].status === 'fulfilled' ? summaries[0].value : [];
  const conversations = summaries[1].status === 'fulfilled' ? summaries[1].value : [];
  const unreadMessagesCount = summaries[2].status === 'fulfilled' ? summaries[2].value : 0;
  const rooms = summaries[3].status === 'fulfilled' ? summaries[3].value : [];
  const unreadConversations: UnreadConversation[] = conversations
    .filter((c) => c.unread > 0)
    .map((c) => ({ id: c.id, guestName: c.guestName, lastMessage: c.lastMessage, lastMessageAt: c.lastMessageAt, unread: c.unread }));
  const roomNameById = new Map(rooms.map((room) => [room.id, room.name]));

  const recentBookings: RecentBooking[] = recentBookingsRaw
    .map((booking) => ({
      reference: booking.reference,
      guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
      roomName: roomNameById.get(booking.roomTypeId) ?? booking.roomTypeId,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      createdAt: booking.createdAt,
    }));

  return (
    <AdminLocaleProvider locale={locale}>
      <AdminShell
        locale={locale}
        member={{ name: member.name, roleLabel: roleLabel(member.role, roles, adminT(locale)) }}
        hotelName={hotel.name}
        location={hotel.location}
        hotels={availableHotels}
        selectedSlug={selectedSlug}
        recentBookings={recentBookings}
        unreadConversations={unreadConversations}
        unreadMessagesCount={unreadMessagesCount}
      >
        {children}
      </AdminShell>
    </AdminLocaleProvider>
  );
}
