import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/application/admin-session';
import { availableHotels, catalogService, communicationsService, DEMO_HOTEL_SLUG, hotelRepository, listRateChanges, subscriptionService, teamService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { roleLabel } from '@/components/admin/settings/team-data';
import { AdminLocaleProvider } from '@/lib/i18n/admin/context';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminT } from '@/lib/i18n/admin/translate';
import { AdminShell } from '@/components/admin/shell/admin-shell';
import type { RecentBooking, UnreadConversation } from '@/components/admin/shell/notification-bell';
import { AdminServiceUnavailable } from '@/components/admin/shell/admin-service-unavailable';
import { signOutAction } from '@/app/(auth)/admin/actions';
import { pill } from '@/lib/ui';

export const dynamic = 'force-dynamic';

const RECENT_BOOKINGS_LIMIT = 50;

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
  if (!session.onboarded && member.role !== 'Hotelier') redirect('/admin/welcome');

  const [requestedSlug, locale, permissions] = await Promise.all([
    getSelectedHotelSlug(), getAdminLocale(), teamService.permissionsForRole(member.role),
  ]);
  const isHotelier = member.role === 'Hotelier';
  const hotelierHotels = availableHotels.filter((hotelOption) => member.hotelIds?.includes(hotelOption.id));
  if (isHotelier && hotelierHotels.length === 0) {
    const t = adminT(locale);
    return <AdminLocaleProvider locale={locale}>
      <main className="mx-auto grid min-h-[70dvh] max-w-xl content-center gap-3 px-5" lang={locale}>
        <h1 className="text-2xl font-semibold">{t('maintenance.hotelRequired')}</h1>
        <p className="text-muted-foreground">{t('maintenance.hotelRequiredBody')}</p>
        <form action={signOutAction}><button type="submit" className={pill('secondary')}>{t('session.signOut')}</button></form>
      </main>
    </AdminLocaleProvider>;
  }
  const selectedSlug = isHotelier
    ? (hotelierHotels.find((hotelOption) => hotelOption.slug === requestedSlug)?.slug ?? hotelierHotels[0]!.slug)
    : requestedSlug;
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
    permissions.includes('team.permViewBookings') ? hotelRepository.listBookings({ hotelId: hotel.id, limit: RECENT_BOOKINGS_LIMIT }) : Promise.resolve([]),
    permissions.includes('team.permViewBookings') ? communicationsService.listConversations(selectedSlug, RECENT_BOOKINGS_LIMIT) : Promise.resolve([]),
    permissions.includes('team.permViewBookings') ? communicationsService.countUnreadConversations(selectedSlug) : Promise.resolve(0),
    permissions.includes('team.permViewBookings') ? hotelRepository.listRooms(hotel.id) : Promise.resolve([]),
    subscriptionService.getAccount(session.memberId),
  ]);
  const summaryNames = ['recent bookings', 'conversations', 'unread count', 'rooms', 'subscription'] as const;
  summaries.forEach((result, index) => {
    if (result.status === 'rejected') {
      const requestId = crypto.randomUUID();
      console.error(`Admin ${summaryNames[index]} summary failed`, { route: '/admin', code: 'service_unavailable', requestId }, result.reason);
    }
  });
  const recentBookingsRaw = summaries[0].status === 'fulfilled' ? summaries[0].value : [];
  const conversations = summaries[1].status === 'fulfilled' ? summaries[1].value : [];
  const messageHotelSlugs = [...new Set([selectedSlug, DEMO_HOTEL_SLUG])];
  const messageFeeds = [{ hotelSlug: selectedSlug, conversations }];
  let unreadMessagesCount = summaries[2].status === 'fulfilled' ? summaries[2].value : 0;
  if (permissions.includes('team.permViewBookings') && selectedSlug !== DEMO_HOTEL_SLUG) {
    try {
      const guestSiteConversations = await communicationsService.listConversations(DEMO_HOTEL_SLUG, RECENT_BOOKINGS_LIMIT);
      messageFeeds.push({ hotelSlug: DEMO_HOTEL_SLUG, conversations: guestSiteConversations });
      unreadMessagesCount += await communicationsService.countUnreadConversations(DEMO_HOTEL_SLUG);
    } catch (error) {
      const requestId = crypto.randomUUID();
      console.error('Admin guest-site messages summary failed', { route: '/admin', code: 'service_unavailable', requestId }, error);
    }
  }
  const rooms = summaries[3].status === 'fulfilled' ? summaries[3].value : [];
  const unreadConversations: UnreadConversation[] = messageFeeds.flatMap(({ hotelSlug, conversations: feed }) => feed
    .filter((c) => c.unread > 0)
    .map((c) => ({ id: c.id, guestName: c.guestName, lastMessage: c.lastMessage, lastMessageAt: c.lastMessageAt, unread: c.unread, hotelSlug })));
  const roomNameById = new Map(rooms.map((room) => [room.id, room.name]));
  const rateChanges = permissions.includes('team.permEditRates') ? await listRateChanges(hotel.id).catch(() => []) : [];

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
        subscriptionAccount={summaries[4].status === 'fulfilled' ? summaries[4].value : null}
        subscriptionNow={Date.now()}
        locale={locale}
        member={{ name: member.name, roleLabel: roleLabel(member.role, roles, adminT(locale)) }}
        maintenanceEnabled={member.role === 'Owner' || member.role === 'Hotelier'}
        maintenanceNotificationsEnabled={member.role === 'Hotelier'}
        permissions={permissions}
        hotelName={hotel.name}
        location={hotel.location}
        hotels={isHotelier ? hotelierHotels.map((option) => ({ ...option, location: availableHotels.find((hotelOption) => hotelOption.id === option.id)?.location ?? '' })) : availableHotels}
        selectedSlug={selectedSlug}
        messageHotelSlugs={messageHotelSlugs}
        recentBookings={recentBookings}
        rateChanges={rateChanges}
        unreadConversations={unreadConversations}
        unreadMessagesCount={unreadMessagesCount}
      >
        {children}
      </AdminShell>
    </AdminLocaleProvider>
  );
}
