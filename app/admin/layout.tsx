import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/application/admin-session';
import { availableHotels, catalogService, hotelRepository, teamService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { roleLabel } from '@/components/admin/settings/team-data';
import { AdminLocaleProvider } from '@/lib/i18n/admin/context';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminT } from '@/lib/i18n/admin/translate';
import { AdminShell } from '@/components/admin/shell/admin-shell';
import type { RecentBooking } from '@/components/admin/shell/notification-bell';

export const dynamic = 'force-dynamic';

const RECENT_BOOKINGS_LIMIT = 8;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The gate in front of every screen. The door itself (`/admin/sign-in`,
  // `/admin/welcome`) lives in `app/(auth)/admin`, outside this layout, so
  // sending someone there never loops back through here. Server actions
  // check the same session themselves (`requireAdminSession`): a layout
  // only guards what renders, not what can be posted to.
  const session = await getAdminSession();
  if (!session) redirect('/admin/sign-in');
  if (!session.onboarded) redirect('/admin/welcome');
  const member = await teamService.findMemberById(session.memberId);
  if (!member) redirect('/admin/sign-in');

  const [selectedSlug, locale, roles] = await Promise.all([getSelectedHotelSlug(), getAdminLocale(), teamService.listRoles()]);
  const [hotel, allBookings] = await Promise.all([catalogService.getHotel(selectedSlug), hotelRepository.listBookings()]);
  const rooms = await hotelRepository.listRooms(hotel.id);
  const roomNameById = new Map(rooms.map((room) => [room.id, room.name]));

  const recentBookings: RecentBooking[] = allBookings
    .filter((booking) => booking.hotelId === hotel.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, RECENT_BOOKINGS_LIMIT)
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
      >
        {children}
      </AdminShell>
    </AdminLocaleProvider>
  );
}
