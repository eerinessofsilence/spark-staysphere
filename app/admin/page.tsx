import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { addDays, parseISO } from 'date-fns';
import { CalendarBlank } from '@phosphor-icons/react/dist/ssr';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { hotelRepository, inventoryService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { toIsoDate } from '@/lib/application/search-params';
import { nightsBetween } from '@/lib/domain/pricing';
import { roomCategory, type RoomCategory } from '@/lib/domain/room-attributes';
import type { Booking, Currency } from '@/lib/domain/schemas';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT, type AdminT } from '@/lib/i18n/admin/translate';
import { lDateRange, lDateShort, lGuests, lMoney, lNights } from '@/lib/i18n/format';
import { INTL_TAGS, type Locale } from '@/lib/i18n/locale';
import { pill } from '@/lib/ui';
import { BookingStatusBadge } from '@/components/admin/operations/booking-status-badge';
import { Donut, MixBar, OccupancyGauge, ValueBars, type ValueBar } from '@/components/admin/operations/kpi-charts';
import { Metric } from '@/components/admin/operations/metric-card';
import { OccupancyChart } from '@/components/admin/operations/occupancy-chart';
import { paginate, parsePage, parsePageSize, Pagination, simplePageHref, simplePageSizeHref } from '@/components/admin/operations/pagination';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('dashboard.title')) };
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const pageSize = parsePageSize(sp.pageSize);
  const today = toIsoDate(new Date());
  const [board, allBookings] = await Promise.all([
    inventoryService.getFrontDesk(await getSelectedHotelSlug(), today, 14),
    hotelRepository.listBookings(),
  ]);
  const { hotel } = board;
  const bookings = allBookings.filter((booking) => booking.hotelId === hotel.id);
  const rooms = await hotelRepository.listRooms(hotel.id);
  const roomNames = new Map(rooms.map((room) => [room.id, room.name]));

  const sorted = [...bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const confirmed = sorted.filter((booking) => booking.status === 'confirmed');
  const revenue = confirmed.reduce((sum, booking) => sum + booking.total, 0);
  const weekEnd = toIsoDate(addDays(parseISO(today), 7));
  const arriving = confirmed
    .filter((booking) => booking.checkIn >= today && booking.checkIn < weekEnd)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const leaving = confirmed
    .filter((booking) => booking.checkOut >= today && booking.checkOut < weekEnd)
    .sort((a, b) => a.checkOut.localeCompare(b.checkOut));
  const { pageItems: recent, page: currentPage, totalPages } = paginate(sorted, page, pageSize);
  const cancelled = sorted.filter((booking) => booking.status === 'cancelled');
  const tonight = board.days[0];
  const onSite = rooms.filter((room) => !room.hidden).length;
  const tomorrow = board.days[1];
  const roomMix = Object.entries(
    board.groups.reduce<Record<string, number>>((mix, group) => {
      const label = t(CATEGORY_PLURAL[roomCategory({ name: group.roomName })]);
      mix[label] = (mix[label] ?? 0) + group.rooms.length;
      return mix;
    }, {}),
  ).map(([label, value]) => ({ label, value }));
  const revenueBars = revenueByQuarter(confirmed, today, hotel.currency, locale);

  return (
    <AdminPage>
      <AdminPageHeader
        title={t('dashboard.title')}
        actions={
          <Link href="/admin/front-desk" className={pill('primary')}>
            {t('dashboard.openFrontDesk')}
          </Link>
        }
      />

      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label={t('dashboard.occupiedTonight')}
          value={`${tonight?.occupied ?? 0} / ${board.totalRooms}`}
          detail={t('dashboard.occupiedDetail')}
          chart={
            <OccupancyGauge
              share={board.totalRooms > 0 ? (tonight?.occupied ?? 0) / board.totalRooms : 0}
              arrivals={tonight?.arrivals ?? 0}
              departures={tonight?.departures ?? 0}
              tomorrowShare={tomorrow && board.totalRooms > 0 ? tomorrow.occupied / board.totalRooms : null}
            />
          }
        />
        <Metric
          label={t('dashboard.roomsInBuilding')}
          value={String(board.totalRooms)}
          detail={t('dashboard.roomsDetail', { onSite, total: rooms.length })}
          chart={<MixBar segments={roomMix} />}
        />
        <Metric
          label={t('dashboard.confirmedBookings')}
          value={String(confirmed.length)}
          detail={t('dashboard.madeInTotal', { count: sorted.length })}
          chart={
            <Donut
              centre={`${sorted.length > 0 ? Math.round((confirmed.length / sorted.length) * 100) : 0}%`}
              caption={t('dashboard.confirmedCaption')}
              slices={[
                { label: t('dashboard.confirmed'), value: confirmed.length, tone: 'accent' },
                { label: t('dashboard.cancelled'), value: cancelled.length, tone: 'light' },
                { label: t('dashboard.notFinished'), value: sorted.length - confirmed.length - cancelled.length, tone: 'stone' },
              ]}
            />
          }
        />
        <Metric
          label={t('dashboard.revenue')}
          value={lMoney(revenue, hotel.currency, locale)}
          detail={t('dashboard.revenueDetail')}
          chart={<ValueBars bars={revenueBars} />}
        />
      </dl>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-main-aside">
        <OccupancyChart days={board.days} totalRooms={board.totalRooms} />

        <section aria-labelledby="week-heading" className="min-w-0 rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
          <h3 id="week-heading" className="font-medium">
            {t('dashboard.next7Days')}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.next7Body')}</p>
          {arriving.length === 0 && leaving.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
              {t('dashboard.noMovements')}
            </p>
          ) : (
            <div className="mt-5 grid gap-6">
              <Movements
                title={t('dashboard.arriving')}
                bookings={arriving}
                dates={arriving.map((booking) => booking.checkIn)}
                roomNames={roomNames}
                t={t}
                locale={locale}
              />
              <Movements
                title={t('dashboard.leaving')}
                bookings={leaving}
                dates={leaving.map((booking) => booking.checkOut)}
                roomNames={roomNames}
                t={t}
                locale={locale}
              />
            </div>
          )}
        </section>
      </div>

      <section aria-labelledby="recent-heading" className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="recent-heading" className="text-display text-3xl">
            {t('dashboard.recentReservations')}
          </h2>
          {recent.length > 0 ? (
            <Link href="/admin/bookings" className={pill('secondary')}>
              {t('dashboard.allReservations')}
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
        </div>

        {recent.length === 0 ? (
          <div className="mt-5 flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-border bg-card p-10 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-stone text-muted-foreground">
              <CalendarBlank weight="fill" className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-display text-2xl">{t('dashboard.noReservationsYet')}</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t('dashboard.noReservationsBody')}</p>
            </div>
            <Link href="/rooms" className={pill('primary')}>
              {t('dashboard.makeDemoBooking')}
            </Link>
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-[18px] bg-card shadow-soft">
            <TableCard caption={t('dashboard.tableCaption')} className="min-w-[50rem]" attached>
              <thead>
                <tr className="border-b border-border">
                  <Th>{t('dashboard.thBookingNumber')}</Th>
                  <Th>{t('dashboard.thGuest')}</Th>
                  <Th>{t('dashboard.thRoom')}</Th>
                  <Th>{t('dashboard.thStay')}</Th>
                  <Th className="text-right">{t('dashboard.thTotal')}</Th>
                  <Th>{t('dashboard.thStatus')}</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((booking) => (
                  <tr
                    key={booking.id}
                    className="relative border-b border-border transition-colors last:border-b-0 hover:bg-stone/50"
                  >
                    <Td className="whitespace-nowrap">
                      <Link
                        href={`/admin/bookings/${booking.reference}`}
                        className="text-display text-base hover:text-accent-strong before:absolute before:inset-0"
                      >
                        {booking.reference}
                      </Link>
                    </Td>
                    <Td>
                      {booking.guest.firstName} {booking.guest.lastName}
                      <span className="block text-xs text-muted-foreground">{booking.guest.email}</span>
                    </Td>
                    <Td>{roomNames.get(booking.roomTypeId) ?? booking.roomTypeId}</Td>
                    <Td className="whitespace-nowrap">
                      {lDateRange(booking.checkIn, booking.checkOut, locale)}
                      <span className="block text-xs text-muted-foreground">
                        {lNights(nightsBetween(booking.checkIn, booking.checkOut), locale)} ·{' '}
                        {lGuests(booking.adults, booking.children, locale)}
                      </span>
                    </Td>
                    <Td className="text-right font-medium tabular-nums">
                      {lMoney(booking.total, booking.currency, locale)}
                    </Td>
                    <Td>
                      <BookingStatusBadge status={booking.status} stayState={booking.stayState} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
            <Pagination
              attached
              page={currentPage}
              totalPages={totalPages}
              total={sorted.length}
              pageSize={pageSize}
              hrefFor={simplePageHref('/admin', pageSize)}
              pageSizeHrefFor={simplePageSizeHref('/admin')}
            />
          </div>
        )}
      </section>
    </AdminPage>
  );
}

const CATEGORY_PLURAL: Record<RoomCategory, AdminTranslationKey> = {
  room: 'category.rooms',
  studio: 'category.studios',
  suite: 'category.suites',
  loft: 'category.lofts',
  residence: 'category.residences',
  penthouse: 'category.penthouses',
};

/**
 * Confirmed revenue by arrival quarter, as an unbroken run of quarters so a gap
 * reads as a quarter with nothing booked rather than being skipped. Kept to the
 * last six; anything earlier folds into the first bar so the bars still add up
 * to the headline total.
 */
function revenueByQuarter(bookings: Booking[], today: string, currency: Currency, locale: Locale): ValueBar[] {
  const compact = new Intl.NumberFormat(INTL_TAGS[locale], { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 });
  const index = (iso: string) => Number(iso.slice(0, 4)) * 4 + Math.floor((Number(iso.slice(5, 7)) - 1) / 3);
  const now = index(today);
  if (bookings.length === 0) return [];
  const totals = new Map<number, number>();
  for (const booking of bookings) {
    const key = index(booking.checkIn);
    totals.set(key, (totals.get(key) ?? 0) + booking.total);
  }
  const last = Math.max(now, ...totals.keys());
  const first = last - 5;
  return Array.from({ length: 6 }, (_, offset) => {
    const key = first + offset;
    const value =
      offset === 0
        ? [...totals].filter(([quarter]) => quarter <= key).reduce((sum, [, total]) => sum + total, 0)
        : (totals.get(key) ?? 0);
    const year = Math.floor(key / 4);
    return {
      label: `Q${(key % 4) + 1} ${String(year).slice(2)}`,
      value,
      display: compact.format(value),
      current: key === now,
    };
  });
}

function Movements({
  title,
  bookings,
  dates,
  roomNames,
  t,
  locale,
}: {
  title: string;
  bookings: Booking[];
  dates: string[];
  roomNames: Map<string, string>;
  t: AdminT;
  locale: Locale;
}): ReactNode {
  return (
    <div>
      <h4 className="text-sm text-muted-foreground">
        {title} · {bookings.length}
      </h4>
      {bookings.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t('dashboard.noneThisWeek')}</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {bookings.map((booking, index) => (
            <li key={booking.id} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
              <span className="min-w-0">
                <Link
                  href={`/admin/bookings/${booking.reference}`}
                  className="font-medium hover:text-accent-strong"
                >
                  {booking.guest.firstName} {booking.guest.lastName}
                </Link>
                <span className="block truncate text-xs text-muted-foreground">
                  {roomNames.get(booking.roomTypeId) ?? booking.roomTypeId} · {booking.reference}
                </span>
              </span>
              <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                {lDateShort(dates[index]!, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
