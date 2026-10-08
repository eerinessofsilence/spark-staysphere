import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/application/admin-session';
import { availableHotels, catalogService, communicationsService, DEMO_HOTEL_SLUG, hotelRepository, listRateChanges, subscriptionService, teamService, tenantService } from '@/lib/application/container';
import { getSelectedHotelSlug, SELECTED_HOTEL_COOKIE } from '@/lib/application/hotel-context';
import { roleLabel } from '@/components/admin/settings/team-data';
import { AdminLocaleProvider } from '@/lib/i18n/admin/context';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminT } from '@/lib/i18n/admin/translate';
import { AdminShell } from '@/components/admin/shell/admin-shell';
import type { RecentBooking, UnreadConversation } from '@/components/admin/shell/notification-bell';
import { AdminServiceUnavailable } from '@/components/admin/shell/admin-service-unavailable';
import { signOutAction } from '@/app/(auth)/admin/actions';
import type { DraftHotel } from '@/lib/domain/tenant';
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
  const locale = await getAdminLocale();
  if (session.tenantAccount) {
    let tenantHotels: DraftHotel[];
    let selectedSlug: string | undefined;
    try {
      tenantHotels = await tenantService.listHotels(session.memberId);
      selectedSlug = (await cookies()).get(SELECTED_HOTEL_COOKIE)?.value;
    } catch (error) {
      const requestId = crypto.randomUUID();
      console.error('Tenant workspace lookup failed', { route: '/admin', code: 'service_unavailable', requestId }, error);
      return <AdminServiceUnavailable locale={locale} />;
    }
    if (!tenantHotels.length) redirect('/admin/onboarding/create-hotel');
    const selected = tenantHotels.find((candidate) => candidate.slug === selectedSlug);
    if (!selected) redirect('/admin/onboarding/select-hotel');
    const trialDate = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(selected.trialEndsAt));
    const title = locale === 'ru' ? 'Ваш отель готов к настройке' : locale === 'de' ? 'Ihr Hotel ist bereit' : 'Your hotel is ready to set up';
    const body = locale === 'ru' ? 'Это пустой кабинет. Добавьте номера и фотографии, когда будете готовы.' : locale === 'de' ? 'Dies ist ein leerer Arbeitsbereich. Zimmer und Fotos können Sie später hinzufügen.' : 'This is an empty workspace. Add rooms and photos when you are ready.';
    const trial = locale === 'ru' ? `Пробный период до ${trialDate}` : locale === 'de' ? `Testphase bis ${trialDate}` : `Free trial until ${trialDate}`;
    const switchLabel = locale === 'ru' ? 'Выбрать другой отель' : locale === 'de' ? 'Anderes Hotel wählen' : 'Choose another hotel';
    return <AdminLocaleProvider locale={locale}>
      <main className="mx-auto grid min-h-dvh max-w-3xl content-center gap-5 px-5 py-12" lang={locale}>
        <p className="text-sm font-medium text-accent-strong">{selected.name}{selected.location ? ` · ${selected.location}` : ''}</p>
        <h1 className="text-display text-4xl sm:text-5xl">{title}</h1>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground">{body}</p>
        <p className="text-sm font-medium">{trial}</p>
        <div className="flex flex-wrap gap-3">
          {tenantHotels.length > 1 && <a href="/admin/onboarding/select-hotel" className={pill('secondary')}>{switchLabel}</a>}
          <a href="/admin/onboarding/create-hotel" className={pill('secondary')}>{adminT(locale)('onboarding.createAnotherHotel')}</a>
          <form action={signOutAction}><button type="submit" className={pill('secondary')}>{adminT(locale)('session.signOut')}</button></form>
        </div>
      </main>
    </AdminLocaleProvider>;
  }
  if (!session.onboarded && member.role !== 'Hotelier') redirect('/admin/welcome');

  const [requestedSlug, permissions] = await Promise.all([
    getSelectedHotelSlug(), teamService.permissionsForRole(member.role),
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
