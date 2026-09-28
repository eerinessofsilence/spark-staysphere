import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BanknotesIcon, CalendarDaysIcon, ClockIcon, EnvelopeIcon, MoonIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { catalogService, hotelRepository, guestDocumentService } from '@/lib/application/container';
import { requirePermission } from '@/lib/application/admin-session';
import { GuestDocuments } from '@/components/admin/operations/guest-documents';
import { bookingsForGuest, buildGuestDirectory } from '@/lib/application/guest-directory';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lDate, lDateRange, lMoney, lNights } from '@/lib/i18n/format';
import { cn } from '@/lib/utils';
import { BookingStatusBadge } from '@/components/admin/operations/booking-status-badge';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { Metric } from '@/components/admin/operations/metric-card';

export const dynamic = 'force-dynamic';

async function loadGuest(id: string) {
  await requirePermission('team.permViewBookings');
  const hotel = await catalogService.getHotel(await getSelectedHotelSlug());
  const [allBookings, profiles] = await Promise.all([
    hotelRepository.listBookings(),
    hotelRepository.listGuestProfiles(hotel.id),
  ]);
  const bookings = allBookings.filter((booking) => booking.hotelId === hotel.id);
  const directory = buildGuestDirectory(bookings, profiles, hotel.currency);
  const guest = directory.find((entry) => entry.id === id);
  if (!guest) return null;
  return { guest, profile: profiles.find((p) => p.email.trim().toLowerCase() === id), hotelId: hotel.id, history: bookingsForGuest(bookings, id), roomTypes: await hotelRepository.listRooms(hotel.id) };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = adminT(await getAdminLocale());
  const loaded = await loadGuest(decodeURIComponent(id));
  const title = loaded ? `${loaded.guest.firstName} ${loaded.guest.lastName}` : t('nav.guests');
  return { title: adminPageTitle(t, title) };
}

export default async function GuestDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const loaded = await loadGuest(decodeURIComponent(id));
  if (!loaded) notFound();
  const { guest, history, roomTypes } = loaded;
  const documentsTab = (await searchParams).tab === 'documents';
  const documents = documentsTab ? (await guestDocumentService.listForGuest(loaded.hotelId, guest.id)).map(({ objectKeys: _keys, hotelId: _hotel, ...document }) => document) : [];
  const roomTypeNames = new Map(roomTypes.map((room) => [room.id, room.name]));

  return (
    <AdminPage>
      <AdminPageHeader
        title={`${guest.firstName} ${guest.lastName}`}
        breadcrumbs={[{ label: t('nav.guests'), href: '/admin/guests' }]}
      />

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <EnvelopeIcon className="size-4" aria-hidden="true" />
          {guest.email}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <PhoneIcon className="size-4" aria-hidden="true" />
          {guest.phone}
        </span>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={<CalendarDaysIcon />}
          label={t('guests.thBookings')}
          value={String(guest.bookingsCount)}
          detail={guest.cancelledCount > 0 ? t('guests.cancelledCount', { count: guest.cancelledCount }) : t('guests.metricBookingsDetail')}
        />
        <Metric icon={<BanknotesIcon />} label={t('guests.thSpent')} value={lMoney(guest.totalSpent, guest.currency, locale)} detail={t('guests.metricSpentDetail')} />
        <Metric icon={<MoonIcon />} label={t('guests.thNights')} value={lNights(guest.nights, locale)} detail={t('guests.metricNightsDetail')} />
        <Metric
          icon={<ClockIcon />}
          label={t('guests.thLastStay')}
          value={guest.lastCheckIn ? lDate(guest.lastCheckIn, locale) : t('guests.neverStayed')}
          detail={t('guests.metricLastStayDetail')}
        />
      </dl>

      {loaded.profile?.identity ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t('documents.dateOfBirth')}: {loaded.profile.identity.dateOfBirth || '—'} · {t('documents.nationality')}: {loaded.profile.identity.nationality || '—'} · {t('guests.gender')}: {loaded.profile.identity.gender || '—'}
        </p>
      ) : null}
      <nav aria-label="Guest profile" className="mt-6 flex w-max gap-1 rounded-full border border-border bg-card p-1">
        {[['bookings', t('guests.bookingsHeading')], ['documents', 'Documents']].map(([key, label]) => <Link key={key} href={`/admin/guests/${encodeURIComponent(guest.id)}?tab=${key}`} aria-current={(key === 'documents') === documentsTab ? 'page' : undefined} className={cn('rounded-full px-4 py-2 text-sm font-medium', (key === 'documents') === documentsTab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-stone')}>{label}</Link>)}
      </nav>
      {documentsTab ? <GuestDocuments documents={documents} /> : <section aria-labelledby="guest-bookings-heading" className="mt-6 overflow-hidden rounded-[18px] bg-card shadow-soft">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <h2 id="guest-bookings-heading" className="text-base font-medium">
            {t('guests.bookingsHeading')}
          </h2>
        </div>
        <div className="overflow-hidden rounded-b-[18px]">
          {history.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground sm:px-6">{t('guests.noBookingsYet')}</p>
          ) : (
            <TableCard caption={t('guests.bookingsHeading')} className="min-w-[48rem]" attached>
              <thead>
                <tr className="border-b border-border">
                  <Th>{t('ops.thBookingNumber')}</Th>
                  <Th>{t('ops.thRoom')}</Th>
                  <Th>{t('ops.thStay')}</Th>
                  <Th className="text-right">{t('ops.thTotal')}</Th>
                  <Th>{t('ops.thStatus')}</Th>
                </tr>
              </thead>
              <tbody>
                {history.map((booking) => (
                  <tr key={booking.id} className="relative border-b border-border transition-colors last:border-b-0 hover:bg-stone/50">
                    <Td className="whitespace-nowrap font-medium">
                      <Link
                        href={`/admin/bookings/${booking.reference}`}
                        className="hover:text-accent-strong before:absolute before:inset-0"
                      >
                        {booking.reference}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap">{roomTypeNames.get(booking.roomTypeId) ?? booking.roomTypeId}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{lDateRange(booking.checkIn, booking.checkOut, locale)}</Td>
                    <Td className="text-right tabular-nums whitespace-nowrap">{lMoney(booking.total, booking.currency, locale)}</Td>
                    <Td>
                      <BookingStatusBadge status={booking.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          )}
        </div>
      </section>}
    </AdminPage>
  );
}
