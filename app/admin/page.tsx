import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { addDays, parseISO } from 'date-fns';
import { CalendarBlank } from '@phosphor-icons/react/dist/ssr';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { DEMO_HOTEL_SLUG, hotelRepository, inventoryService } from '@/lib/application/container';
import type { TapeChartDay } from '@/lib/application/inventory-service';
import { toIsoDate } from '@/lib/application/search-params';
import { nightsBetween } from '@/lib/domain/pricing';
import type { Booking } from '@/lib/domain/schemas';
import { formatDateRange, formatDateShort, formatGuests, formatMoney, formatNights } from '@/lib/formatting';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { BookingStatusBadge } from '@/components/admin/operations/booking-status-badge';
import { Meter, Metric } from '@/components/admin/operations/metric-card';
import { OccupancyChart } from '@/components/admin/operations/occupancy-chart';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const metadata: Metadata = {
  title: 'Dashboard — Hotel admin | SPARK StaySphere 360',
};

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  const today = toIsoDate(new Date());
  const [board, bookings] = await Promise.all([
    inventoryService.getTapeChart(DEMO_HOTEL_SLUG, today, 14),
    hotelRepository.listBookings(),
  ]);
  const { hotel } = board;
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
  const recent = sorted.slice(0, 5);
  const cancelled = sorted.filter((booking) => booking.status === 'cancelled');
  const tonight = board.days[0];
  const occupancy = tonight && board.totalRooms > 0 ? Math.round((tonight.occupied / board.totalRooms) * 100) : 0;
  const onSite = rooms.filter((room) => !room.hidden).length;
  const cancelledRevenue = cancelled.reduce((sum, booking) => sum + booking.total, 0);
  const grossRevenue = revenue + cancelledRevenue;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Dashboard"
        actions={
          <Link href="/admin/tape-chart" className={pill('primary')}>
            Open tape chart
          </Link>
        }
      />

      <dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric
          label="Occupied tonight"
          value={`${tonight?.occupied ?? 0} / ${board.totalRooms}`}
          detail={`${occupancy}% · ${tonight?.arrivals ?? 0} arriving, ${tonight?.departures ?? 0} leaving`}
          chart={<Sparkline days={board.days} totalRooms={board.totalRooms} />}
        />
        <Metric
          label="Rooms in the building"
          value={String(board.totalRooms)}
          detail={`${onSite} of ${rooms.length} room types on the site`}
          chart={<Meter share={rooms.length > 0 ? onSite / rooms.length : 1} />}
        />
        <Metric
          label="Confirmed bookings"
          value={String(confirmed.length)}
          detail={
            cancelled.length === 0
              ? 'No cancellations'
              : cancelled.length === 1
                ? '1 cancelled'
                : `${cancelled.length} cancelled`
          }
          chart={<Meter share={sorted.length > 0 ? confirmed.length / sorted.length : 1} />}
        />
        <Metric
          label="Revenue"
          value={formatMoney(revenue, hotel.currency)}
          detail="From confirmed demo stays"
          chart={<Meter share={grossRevenue > 0 ? revenue / grossRevenue : 1} />}
        />
      </dl>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-main-aside">
        <OccupancyChart days={board.days} totalRooms={board.totalRooms} />

        <section aria-labelledby="week-heading" className="min-w-0 rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
          <h3 id="week-heading" className="font-medium">
            Next 7 days
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Demo bookings arriving and leaving. Simulated demand isn&apos;t listed.
          </p>
          {arriving.length === 0 && leaving.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
              No demo arrivals or departures this week. A booking that starts within seven days shows up here.
            </p>
          ) : (
            <div className="mt-5 grid gap-6">
              <Movements title="Arriving" bookings={arriving} dates={arriving.map((booking) => booking.checkIn)} roomNames={roomNames} />
              <Movements title="Leaving" bookings={leaving} dates={leaving.map((booking) => booking.checkOut)} roomNames={roomNames} />
            </div>
          )}
        </section>
      </div>

      <section aria-labelledby="recent-heading" className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="recent-heading" className="text-display text-3xl">
            Recent reservations
          </h2>
          {recent.length > 0 ? (
            <Link href="/admin/bookings" className={pill('secondary')}>
              All reservations
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
              <h3 className="text-display text-2xl">No reservations yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Complete a demo booking on the guest site and it appears here, on the tape chart, and in
                Reservations.
              </p>
            </div>
            <Link href="/rooms" className={pill('primary')}>
              Make a demo booking
            </Link>
          </div>
        ) : (
          <div className="mt-5">
            <TableCard caption="The five most recent demo bookings" className="min-w-[50rem]">
              <thead>
                <tr className="border-b border-border">
                  <Th>Booking number</Th>
                  <Th>Guest</Th>
                  <Th>Room</Th>
                  <Th>Stay</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((booking) => (
                  <tr key={booking.id} className="border-b border-border last:border-b-0">
                    <Td className="whitespace-nowrap">
                      <Link
                        href={`/admin/bookings/${booking.reference}`}
                        className="text-display text-base hover:text-accent-strong"
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
                      {formatDateRange(booking.checkIn, booking.checkOut)}
                      <span className="block text-xs text-muted-foreground">
                        {formatNights(nightsBetween(booking.checkIn, booking.checkOut))} ·{' '}
                        {formatGuests(booking.adults, booking.children)}
                      </span>
                    </Td>
                    <Td className="text-right font-medium tabular-nums">
                      {formatMoney(booking.total, booking.currency)}
                    </Td>
                    <Td>
                      <BookingStatusBadge status={booking.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          </div>
        )}
      </section>
    </AdminPage>
  );
}

/** 14-point trend, tonight in the accent and the rest in the de-emphasis hue — same marks as `OccupancyChart` below it. */
function Sparkline({ days, totalRooms }: { days: TapeChartDay[]; totalRooms: number }) {
  return (
    <div aria-hidden="true" className="mt-4 flex h-8 items-end gap-0.5">
      {days.map((day, index) => {
        const value = totalRooms > 0 ? Math.round((day.occupied / totalRooms) * 100) : 0;
        return (
          <span
            key={day.date}
            className={cn('min-w-0 flex-1 rounded-t-[2px]', index === 0 ? 'bg-accent' : 'bg-tint-stone-ink/40')}
            style={{ height: `${Math.max(value, 4)}%` }}
          />
        );
      })}
    </div>
  );
}

function Movements({
  title,
  bookings,
  dates,
  roomNames,
}: {
  title: string;
  bookings: Booking[];
  dates: string[];
  roomNames: Map<string, string>;
}): ReactNode {
  return (
    <div>
      <h4 className="text-sm text-muted-foreground">
        {title} · {bookings.length}
      </h4>
      {bookings.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">None this week.</p>
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
                {formatDateShort(dates[index]!)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
