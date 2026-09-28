import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { catalogService, hotelRepository } from '@/lib/application/container';
import { attachableBookings, summarizeGroup } from '@/lib/application/group-directory';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lDate, lDateRange, lMoney } from '@/lib/i18n/format';
import { Metric } from '@/components/admin/operations/metric-card';
import { BookingStatusBadge } from '@/components/admin/operations/booking-status-badge';
import { AttachBookingForm, DeleteGroupButton, RemoveFromGroupButton } from '@/components/admin/operations/group-actions';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const dynamic = 'force-dynamic';

async function loadGroup(id: string) {
  const hotel = await catalogService.getHotel(await getSelectedHotelSlug());
  const [group, allBookings, roomTypes] = await Promise.all([
    hotelRepository.getBookingGroup(id),
    hotelRepository.listBookings(),
    hotelRepository.listRooms(hotel.id),
  ]);
  if (!group || group.hotelId !== hotel.id) return null;
  return { hotel, group, summary: summarizeGroup(group, allBookings), roomTypes, allBookings };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = adminT(await getAdminLocale());
  const loaded = await loadGroup(id);
  return { title: adminPageTitle(t, loaded ? loaded.group.name : t('nav.groups')) };
}

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const loaded = await loadGroup(id);
  if (!loaded) notFound();
  const { hotel, group, summary, roomTypes, allBookings } = loaded;
  const roomTypeNames = new Map(roomTypes.map((room) => [room.id, room.name]));

  const attachOptions = attachableBookings(allBookings, hotel.id, group.id)
    .filter((booking) => !summary.bookings.some((member) => member.id === booking.id))
    .map((booking) => ({
      id: booking.id,
      reference: booking.reference,
      guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
      roomName: roomTypeNames.get(booking.roomTypeId) ?? booking.roomTypeId,
    }));

  return (
    <AdminPage>
      <AdminPageHeader
        title={group.name}
        breadcrumbs={[{ label: t('nav.groups'), href: '/admin/groups' }]}
        actions={<DeleteGroupButton groupId={group.id} name={group.name} />}
      />

      {group.notes ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{group.notes}</p> : null}

      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric label={t('guests.thBookings')} value={String(summary.bookingsCount)} detail={t('groups.metricBookingsDetail')} />
        <Metric label={t('groups.thAmount')} value={lMoney(summary.amount, hotel.currency, locale)} detail={t('groups.metricAmountDetail')} />
        <Metric label={t('groups.thCreated')} value={lDate(group.createdAt.slice(0, 10), locale)} detail={t('groups.metricCreatedDetail')} />
      </dl>

      <section aria-labelledby="group-attach-heading" className="mt-6 rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
        <h2 id="group-attach-heading" className="text-base font-medium">
          {t('groups.attachHeading')}
        </h2>
        <div className="mt-4">
          <AttachBookingForm groupId={group.id} options={attachOptions} />
        </div>
      </section>

      <section aria-labelledby="group-bookings-heading" className="mt-6 overflow-hidden rounded-[18px] bg-card shadow-soft">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <h2 id="group-bookings-heading" className="text-base font-medium">
            {t('guests.bookingsHeading')}
          </h2>
        </div>
        <div className="overflow-hidden rounded-b-[18px]">
          {summary.bookings.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground sm:px-6">{t('groups.noBookingsYet')}</p>
          ) : (
            <TableCard caption={t('guests.bookingsHeading')} className="min-w-[52rem]" attached>
              <thead>
                <tr className="border-b border-border">
                  <Th>{t('ops.thBookingNumber')}</Th>
                  <Th>{t('ops.thGuest')}</Th>
                  <Th>{t('ops.thRoom')}</Th>
                  <Th>{t('ops.thStay')}</Th>
                  <Th className="text-right">{t('ops.thTotal')}</Th>
                  <Th>{t('ops.thStatus')}</Th>
                  <Th className="w-12">
                    <span className="sr-only">{t('ops.thActions')}</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {summary.bookings.map((booking) => (
                  <tr key={booking.id} className="relative border-b border-border transition-colors last:border-b-0 hover:bg-stone/50">
                    <Td className="whitespace-nowrap font-medium">
                      <Link href={`/admin/bookings/${booking.reference}`} className="hover:text-accent-strong before:absolute before:inset-0">
                        {booking.reference}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {booking.guest.firstName} {booking.guest.lastName}
                      <span className="block text-xs text-muted-foreground">{booking.guest.email}</span>
                    </Td>
                    <Td className="whitespace-nowrap">{roomTypeNames.get(booking.roomTypeId) ?? booking.roomTypeId}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{lDateRange(booking.checkIn, booking.checkOut, locale)}</Td>
                    <Td className="text-right tabular-nums whitespace-nowrap">{lMoney(booking.total, booking.currency, locale)}</Td>
                    <Td>
                      <BookingStatusBadge status={booking.status} />
                    </Td>
                    <Td className="text-right">
                      <RemoveFromGroupButton bookingId={booking.id} reference={booking.reference} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          )}
        </div>
      </section>
    </AdminPage>
  );
}
