import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { addDays, parseISO } from 'date-fns';
import { Bed, CalendarBlank, SignIn, SignOut } from '@phosphor-icons/react/dist/ssr';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { demoControl, hotelRepository, housekeepingService, inventoryService } from '@/lib/application/container';
import {
  mealsByDay,
  nextArrivals,
  nextDepartures,
  reservationBuckets,
  revenueKpis,
  roomTypeAvailability,
  todayMovements,
} from '@/lib/application/dashboard-stats';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { toIsoDate } from '@/lib/application/search-params';
import { HOUSEKEEPING_STATUSES } from '@/lib/domain/housekeeping';
import { nightsBetween } from '@/lib/domain/pricing';
import { roomCategory, type RoomCategory } from '@/lib/domain/room-attributes';
import type { Booking, Currency } from '@/lib/domain/schemas';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { housekeepingStatusKey } from '@/lib/i18n/admin/housekeeping';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT, type AdminT } from '@/lib/i18n/admin/translate';
import { lDateRange, lDateShort, lGuests, lMoney, lNights, STATUS_LABEL } from '@/lib/i18n/format';
import { INTL_TAGS, type Locale } from '@/lib/i18n/locale';
import { pill } from '@/lib/ui';
import { BookingStatusBadge } from '@/components/admin/operations/booking-status-badge';
import { BarList, Donut, MixBar, OccupancyGauge, ValueBars, type ValueBar } from '@/components/admin/operations/kpi-charts';
import { Metric } from '@/components/admin/operations/metric-card';
import { OccupancyChart } from '@/components/admin/operations/occupancy-chart';
import chartTones from '@/components/admin/operations/chart-gradients.module.css';
import { RevenueTrend } from '@/components/admin/operations/revenue-trend';
import { StayMoveButton } from '@/components/admin/operations/stay-move-button';
import { stayStateKey } from '@/lib/i18n/admin/stay-state';
import { cn } from '@/lib/utils';
import { TodaySearch } from '@/components/admin/operations/today-search';
import { paginate, parsePage, parsePageSize, Pagination, simplePageHref, simplePageSizeHref } from '@/components/admin/operations/pagination';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const dynamic = 'force-dynamic';

// Same colours as `HousekeepingStatusBadge`: dirty the warning ink, clean and
// inspected the same green as a checked-in stay, out of order the danger
// ink — a status means the same thing on this mix bar as everywhere else.
const housekeepingMixTone: Record<(typeof HOUSEKEEPING_STATUSES)[number], string> = {
  dirty: chartTones.statusWarning,
  in_progress: chartTones.stone,
  clean: chartTones.statusSuccess,
  inspected: chartTones.statusInHouse,
  out_of_order: chartTones.statusDanger,
};

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
  const hotelSlug = await getSelectedHotelSlug();
  const [board, allBookings, housekeepingRooms] = await Promise.all([
    inventoryService.getFrontDesk(hotelSlug, today, 14),
    hotelRepository.listBookings(),
    housekeepingService.listRooms(hotelSlug, today),
  ]);
  const { hotel } = board;
  const bookings = allBookings.filter((booking) => booking.hotelId === hotel.id);
  const rooms = await hotelRepository.listRooms(hotel.id);
  const roomNames = new Map(rooms.map((room) => [room.id, room.name]));
  const [addOns, ratePlanLists, overrides] = await Promise.all([
    hotelRepository.listAddOns(hotel.id),
    Promise.all(rooms.map((room) => hotelRepository.listRatePlans(room.id))),
    Promise.all(rooms.map(async (room) => [room.id, await demoControl.getRoomStatusOverride(room.id)] as const)),
  ]);

  const buckets = reservationBuckets(bookings, today);
  const moves = todayMovements(bookings, today);
  // An empty day still shows who is next, so the desk never looks at a blank column.
  const arrivalsShown = moves.arrivals.length > 0 ? moves.arrivals : nextArrivals(bookings, today, 6);
  const departuresShown = moves.departures.length > 0 ? moves.departures : nextDepartures(bookings, today, 6);
  const stayDetails = (booking: Booking) => ({
    guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
    roomName: roomNames.get(booking.roomTypeId) ?? booking.roomTypeId,
    stay: lDateRange(booking.checkIn, booking.checkOut, locale),
    guests: lGuests(booking.adults, booking.children, locale),
  });
  const housekeepingMix = HOUSEKEEPING_STATUSES.map((status) => ({
    status,
    label: t(housekeepingStatusKey(status)),
    value: housekeepingRooms.filter((room) => room.status === status).length,
    tone: housekeepingMixTone[status],
  }));
  const availability = roomTypeAvailability(board, new Map(overrides));
  const meals = mealsByDay(bookings, ratePlanLists.flat(), addOns, board.days.slice(0, 7).map((day) => day.date));
  // The last week of the night's money, oldest first, today last — one KPI set per day.
  const revenueDays = Array.from({ length: 7 }, (_, offset) => {
    const date = toIsoDate(addDays(parseISO(today), offset - 6));
    return { date, ...revenueKpis(bookings, board.totalRooms, date) };
  });

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
  // One category says nothing as a breakdown ("Rooms · 100%"): a hotel of
  // only rooms is shown by room type instead, which is the split it has.
  const roomSplit =
    roomMix.length > 1
      ? roomMix
      : Object.entries(
          board.groups.reduce<Record<string, number>>((mix, group) => {
            mix[group.roomName] = (mix[group.roomName] ?? 0) + group.rooms.length;
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
          chart={<BarList segments={roomSplit} otherLabel={t('dashboard.mixOther')} />}
        />
        <Metric
          label={t('dashboard.confirmedBookings')}
          value={String(confirmed.length)}
          detail={t('dashboard.madeInTotal', { count: sorted.length })}
          chart={
            <Donut
              centre={String(confirmed.length)}
              caption={t('dashboard.bookingsCaption')}
              slices={[
                { label: t('dashboard.bucketUpcoming'), value: buckets.upcoming + buckets.dueIn, tone: 'accent' },
                { label: t('dashboard.bucketInHouse'), value: buckets.inHouse + buckets.dueOut, tone: 'light' },
                { label: t('dashboard.bucketCompleted'), value: buckets.completed, tone: 'stone' },
              ]}
              footnote={buckets.other > 0 ? t('dashboard.bookingsOther', { count: buckets.other }) : undefined}
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

      {/* Two columns that flow on their own — the wide one for the day and the
          board, the narrow one for the smaller widgets — rather than one grid
          whose rows would stretch every short card to its tallest neighbour.
          Each column's last card grows to the row's foot, so whichever column
          is shorter (a hotel with three room types, or one with thirty)
          ends in a card rather than in a hole. */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-main-aside">
        <div className="flex min-w-0 flex-col gap-6">
        <section aria-labelledby="today-heading" className="min-w-0 rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 id="today-heading" className="font-medium">
                {t('dashboard.today')} · {lDateShort(today, locale)}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.todayBody')}</p>
            </div>
            <TodaySearch target="today-lanes" />
          </div>
          {/* Three lanes with a hairline between them: on a phone they stack and the
              line runs across, from `sm` up they sit side by side and it runs down. */}
          <div id="today-lanes" className="mt-5 grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <Movements
              kind="arrival"
              title={t('dashboard.arriving')}
              count={moves.arrivals.length}
              detail={moves.arrivals.length === 0 && arrivalsShown.length > 0 ? t('dashboard.nextUp') : undefined}
              bookings={arrivalsShown}
              dates={arrivalsShown.map((booking) => booking.checkIn)}
              showDates={moves.arrivals.length === 0}
              roomNames={roomNames}
              t={t}
              locale={locale}
              empty={t('dashboard.noneToday')}
              limit={6}
              action={(booking) =>
                booking.stayState === 'booked' ? (
                  <StayMoveButton reference={booking.reference} from="booked" to="checked_in" {...stayDetails(booking)} />
                ) : (
                  <BookingStatusBadge status={booking.status} stayState={booking.stayState} />
                )
              }
            />
            <Movements
              kind="departure"
              title={t('dashboard.leaving')}
              count={moves.departures.length}
              detail={moves.departures.length === 0 && departuresShown.length > 0 ? t('dashboard.nextUp') : undefined}
              bookings={departuresShown}
              dates={departuresShown.map((booking) => booking.checkOut)}
              showDates={moves.departures.length === 0}
              roomNames={roomNames}
              t={t}
              locale={locale}
              empty={t('dashboard.noneToday')}
              limit={6}
              action={(booking) =>
                booking.stayState === 'checked_in' ? (
                  <StayMoveButton reference={booking.reference} from="checked_in" to="checked_out" {...stayDetails(booking)} />
                ) : (
                  <BookingStatusBadge status={booking.status} stayState={booking.stayState} />
                )
              }
            />
          </div>
          {/* Who is already here, under the two doors of the day: full width,
              so a name and its room read whole, the way the lanes above do
              in half the space each. */}
          <div className="mt-4 border-t border-border pt-4">
            <Movements
              kind="inHouse"
              title={t('dashboard.inHouse')}
              detail={lGuests(moves.adults, moves.children, locale)}
              bookings={moves.inHouse}
              dates={moves.inHouse.map((booking) => booking.checkOut)}
              roomNames={roomNames}
              t={t}
              locale={locale}
              empty={t('dashboard.noneToday')}
              limit={6}
              columns={2}
            />
          </div>
        </section>

        <OccupancyChart days={board.days} totalRooms={board.totalRooms} />


        <section aria-labelledby="week-heading" className="min-w-0 flex-1 rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
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
                kind="arrival"
                title={t('dashboard.arriving')}
                bookings={arriving}
                dates={arriving.map((booking) => booking.checkIn)}
                roomNames={roomNames}
                t={t}
                locale={locale}
              />
              <Movements
                kind="departure"
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

        <div className="flex min-w-0 flex-col gap-6">
          <section aria-labelledby="housekeeping-heading" className="min-w-0 rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 id="housekeeping-heading" className="font-medium">{t('dashboard.housekeeping')}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.housekeepingBody')}</p>
              </div>
              <Link href="/admin/housekeeping" className={pill('secondary', 'min-h-10 px-4 text-sm')}>
                {t('dashboard.openHousekeeping')}
              </Link>
            </div>
            <MixBar segments={housekeepingMix.map(({ label, value, tone }) => ({ label, value, tone }))} />
          </section>

          <section aria-labelledby="revenue-today-heading" className="min-w-0 rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
            <h3 id="revenue-today-heading" className="font-medium">{t('dashboard.revenueToday')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.revenueTodayBody')}</p>
            <RevenueTrend days={revenueDays} currency={hotel.currency} />
          </section>
        <section aria-labelledby="meals-heading" className="min-w-0 flex-1 rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
          <h3 id="meals-heading" className="font-medium">{t('dashboard.meals')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.mealsBody')}</p>
          <ValueBars
            bars={meals.map((day, index) => ({
              label: lDateShort(day.date, locale).replace(/^\S+\s/, ''),
              value: day.breakfast,
              display: String(day.breakfast),
              current: index === 0,
            }))}
          />
          <table className="mt-4 w-full border-collapse text-sm">
            <caption className="sr-only">{t('dashboard.meals')}</caption>
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th scope="col" className="py-2 text-left font-normal">{t('dashboard.thDay')}</th>
                <th scope="col" className="py-2 text-right font-normal">{t('dashboard.breakfast')}</th>
                <th scope="col" className="py-2 text-right font-normal">{t('dashboard.dining')}</th>
              </tr>
            </thead>
            <tbody>
              {meals.map((day) => (
                <tr key={day.date} className="border-b border-border last:border-b-0">
                  <td className="py-2 whitespace-nowrap">{lDateShort(day.date, locale)}</td>
                  <td className="py-2 text-right tabular-nums">{day.breakfast}</td>
                  <td className="py-2 text-right tabular-nums">{day.dining}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        </div>
      </div>

        <section aria-labelledby="rooms-by-type-heading" className="mt-6 min-w-0 overflow-hidden rounded-[18px] bg-card shadow-soft">
          <div className="p-5 pb-0 sm:p-6 sm:pb-0">
            <h3 id="rooms-by-type-heading" className="font-medium">{t('dashboard.roomsByType')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.roomsByTypeBody')}</p>
          </div>
          <div className="mt-4">
            <TableCard caption={t('dashboard.roomsByType')} className="min-w-[28rem]" attached>
              <thead>
                <tr className="border-b border-border">
                  <Th>{t('dashboard.thRoomType')}</Th>
                  <Th className="text-right">{t('dashboard.thTotalRooms')}</Th>
                  <Th className="text-right">{t('dashboard.thSold')}</Th>
                  <Th className="text-right">{t('dashboard.thAvailable')}</Th>
                  <Th>{t('dashboard.thSaleStatus')}</Th>
                </tr>
              </thead>
              <tbody>
                {availability.map((row) => (
                  <tr key={row.roomTypeId} className="relative border-b border-border transition-colors last:border-b-0 hover:bg-stone/50">
                    <Td className="font-medium">
                      <Link href={`/admin/rates/${row.roomTypeId}`} className="hover:text-accent-strong before:absolute before:inset-0">
                        {row.name}
                      </Link>
                    </Td>
                    <Td className="text-right tabular-nums">{row.total}</Td>
                    <Td className="text-right tabular-nums">{row.sold}</Td>
                    <Td className="text-right tabular-nums">{row.available}</Td>
                    <Td className="whitespace-nowrap">{STATUS_LABEL[locale][row.status]}</Td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          </div>
        </section>

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
  // Start at the first quarter that earned anything (at most six back, at least four shown): leading empty bars say nothing.
  const earliest = Math.min(...totals.keys());
  const span = Math.max(4, Math.min(6, last - earliest + 1));
  const first = last - span + 1;
  return Array.from({ length: span }, (_, offset) => {
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
  detail,
  bookings,
  dates,
  roomNames,
  t,
  locale,
  empty,
  limit,
  action,
  count,
  showDates,
  columns = 1,
  kind,
}: {
  title: string;
  /** Which door this lane is: sets the mark at each row's start — the same glyphs as `BookingStatusBadge`, coloured once the move has happened. */
  kind: 'arrival' | 'departure' | 'inHouse';
  /** The figure beside the heading — today's count, even when the list falls back to what is next. */
  count?: number;
  /** One muted line under the heading — the head count in house, say. */
  detail?: string;
  /** With `action` taking the row's end, put the date on the subline instead. */
  showDates?: boolean;
  bookings: Booking[];
  dates: string[];
  roomNames: Map<string, string>;
  t: AdminT;
  locale: Locale;
  empty?: string;
  /** Show at most this many; the rest fold into one "+N" line. */
  limit?: number;
  /** Rendered at the row's end instead of its date — the desk's move for that stay. */
  action?: (booking: Booking) => ReactNode;
  /** Lay the rows out in this many columns from `sm` up — for a lane that has the card's full width. */
  columns?: 1 | 2;
}): ReactNode {
  const listClass = columns === 2 ? 'mt-3 grid gap-1.5 sm:grid-cols-2' : 'mt-3 grid gap-1.5';
  const shown = limit ? bookings.slice(0, limit) : bookings;
  // Coloured once the move has happened — a guest who has come through the
  // door — and muted while it is still due, so a lane reads at a glance.
  const mark = (booking: Booking): { Icon: typeof SignIn; tone: string; label: string } => {
    if (kind === 'inHouse') return { Icon: Bed, tone: 'bg-stay-in-house/10 text-stay-in-house', label: t('dashboard.inHouse') };
    if (kind === 'arrival') {
      return booking.stayState === 'checked_in' || booking.stayState === 'checked_out'
        ? { Icon: SignIn, tone: 'bg-stay-in-house/10 text-stay-in-house', label: t(stayStateKey('checked_in')) }
        : { Icon: SignIn, tone: 'bg-card text-muted-foreground', label: t('dashboard.arriving') };
    }
    return booking.stayState === 'checked_out'
      ? { Icon: SignOut, tone: 'bg-stay-checked-out text-stay-checked-out-ink', label: t(stayStateKey('checked_out')) }
      : { Icon: SignOut, tone: 'bg-card text-muted-foreground', label: t('dashboard.leaving') };
  };
  return (
    <div className="min-w-0 py-4 first:pt-0 last:pb-0 sm:px-5 sm:py-0 sm:first:pl-0 sm:last:pr-0">
      <h4 className="text-sm font-medium">
        {title} <span className="text-muted-foreground">· {count ?? bookings.length}</span>
      </h4>
      {detail ? <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p> : null}
      {bookings.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty ?? t('dashboard.noneThisWeek')}</p>
      ) : (
        <ul className={listClass}>
          {shown.map((booking, index) => (
            <li
              key={booking.id}
              data-search={`${booking.guest.firstName} ${booking.guest.lastName} ${roomNames.get(booking.roomTypeId) ?? ''} ${booking.reference}`.toLowerCase()}
              className="flex min-w-0 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm odd:bg-stone/70 even:bg-stone/30"
            >
              {(() => {
                const { Icon, tone, label } = mark(booking);
                return (
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', tone)}>
                    <Icon weight="fill" className="size-4" aria-hidden="true" />
                    <span className="sr-only">{label}</span>
                  </span>
                );
              })()}
              <span className="min-w-0 flex-1">
                <Link
                  href={`/admin/bookings/${booking.reference}`}
                  className="block truncate font-medium hover:text-accent-strong"
                >
                  {booking.guest.firstName} {booking.guest.lastName}
                </Link>
                <span className="block truncate text-xs text-muted-foreground">
                  {roomNames.get(booking.roomTypeId) ?? booking.roomTypeId} · {booking.reference}
                  {action && showDates ? ` · ${lDateShort(dates[index]!, locale)}` : ''}
                </span>
              </span>
              {action ? (
                <span className="shrink-0">{action(booking)}</span>
              ) : (
                <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                  {lDateShort(dates[index]!, locale)}
                </span>
              )}
            </li>
          ))}
          {bookings.length > shown.length ? (
            <li className="px-3 py-1.5 text-xs text-muted-foreground">+{bookings.length - shown.length}</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
