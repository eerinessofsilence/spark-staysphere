import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarBlank, MagnifyingGlass, PushPin } from '@phosphor-icons/react/dist/ssr';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import {
  catalogService,
  DEMO_HOTEL_SLUG,
  hotelRepository,
  inventoryService,
} from '@/lib/application/container';
import { toIsoDate } from '@/lib/application/search-params';
import { nightsBetween } from '@/lib/domain/pricing';
import type { Booking } from '@/lib/domain/schemas';
import { formatDateRange, formatGuests, formatMoney, formatNights } from '@/lib/formatting';
import { fieldClass, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import {
  stayBucket,
  stayBucketLabels,
  stayBuckets,
  type StayBucket,
} from '@/components/admin/operations/booking-buckets';
import { BookingStatusBadge } from '@/components/admin/operations/booking-status-badge';
import { PaymentSummary } from '@/components/admin/operations/payment-state';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const metadata: Metadata = { title: 'Reservations — Hotel admin | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

type Filter = 'all' | StayBucket;

function parseFilter(value: string | string[] | undefined): Filter {
  return typeof value === 'string' && (stayBuckets as string[]).includes(value) ? (value as StayBucket) : 'all';
}

function matches(booking: Booking, query: string): boolean {
  const needle = query.toLowerCase();
  return [booking.reference, `${booking.guest.firstName} ${booking.guest.lastName}`, booking.guest.email].some(
    (value) => value.toLowerCase().includes(needle),
  );
}

function hrefFor(filter: Filter, query: string): string {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (filter !== 'all') params.set('status', filter);
  const search = params.toString();
  return search ? `/admin/bookings?${search}` : '/admin/bookings';
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q.trim() : '';
  const filter = parseFilter(params.status);
  const today = toIsoDate(new Date());

  const [hotel, bookings] = await Promise.all([
    catalogService.getHotel(DEMO_HOTEL_SLUG),
    hotelRepository.listBookings(),
  ]);
  const rooms = await hotelRepository.listRooms(hotel.id);
  const roomNames = new Map(rooms.map((room) => [room.id, room.name]));

  const sorted = [...bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const searched = query ? sorted.filter((booking) => matches(booking, query)) : sorted;
  const counts: Record<Filter, number> = { all: searched.length, upcoming: 0, in_house: 0, past: 0, cancelled: 0 };
  for (const booking of searched) counts[stayBucket(booking, today)] += 1;
  const visible = filter === 'all' ? searched : searched.filter((booking) => stayBucket(booking, today) === filter);

  const rows = await Promise.all(
    visible.map(async (booking) => {
      const [room, payments] = await Promise.all([
        inventoryService.getBookingRoom(booking),
        hotelRepository.listPaymentAttempts(booking.id),
      ]);
      return { booking, room, payments };
    }),
  );

  const filters: Filter[] = ['all', ...stayBuckets];

  return (
    <AdminPage>
      <AdminPageHeader title="Reservations" />

      <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filter reservations by stay" className="-mx-1 flex flex-wrap gap-2 px-1">
          {filters.map((option) => {
            const current = option === filter;
            return (
              <Link
                key={option}
                href={hrefFor(option, query)}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors',
                  current
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border bg-card text-foreground hover:bg-stone',
                )}
              >
                {option === 'all' ? 'All' : stayBucketLabels[option]}
                <span className={cn('tabular-nums', current ? 'opacity-80' : 'text-muted-foreground')}>
                  {counts[option]}
                </span>
              </Link>
            );
          })}
        </nav>

        <form role="search" action="/admin/bookings" method="get" className="flex w-full gap-2 lg:w-auto">
          {filter !== 'all' ? <input type="hidden" name="status" value={filter} /> : null}
          <label htmlFor="bookings-search" className="sr-only">
            Search by reference, guest, or email
          </label>
          <div className="relative min-w-0 flex-1 lg:w-80 lg:flex-none">
            <MagnifyingGlassIcon
              className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="bookings-search"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Reference, guest, or email"
              className={cn(fieldClass, 'pl-10')}
            />
          </div>
          <button type="submit" className={pill('secondary')}>
            Search
          </button>
        </form>
      </div>

      <div className="mt-6">
        {sorted.length === 0 ? (
          <EmptyState
            title="No bookings to show yet"
            body="Demo bookings made on the guest site appear here with their guest, room, and payment."
            action={
              <Link href="/rooms" className={pill('primary')}>
                Make a demo booking
              </Link>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            search
            title="No bookings match"
            body={query ? `Nothing matches “${query}” in this view.` : 'There are no bookings in this view.'}
            action={
              <Link href="/admin/bookings" className={pill('secondary')}>
                Clear search and filters
              </Link>
            }
          />
        ) : (
          <TableCard caption="Reservations matching the current search and filter" className="min-w-[62rem]">
            <thead>
              <tr className="border-b border-border">
                <Th>Reference</Th>
                <Th>Guest</Th>
                <Th>Room</Th>
                <Th>Stay</Th>
                <Th className="text-right">Total</Th>
                <Th>Payment</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ booking, room, payments }) => (
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
                  <Td>
                    {roomNames.get(booking.roomTypeId) ?? booking.roomTypeId}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {room ? (
                        <>
                          Room {room.number}
                          {booking.status === 'cancelled' ? (
                            ' · released'
                          ) : room.chosenByGuest ? (
                            <>
                              <PushPin weight="fill" className="size-3.5 text-foreground" aria-hidden="true" />
                              <span className="sr-only">(chosen by the guest)</span>
                            </>
                          ) : null}
                        </>
                      ) : (
                        'No room held'
                      )}
                    </span>
                  </Td>
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
                    <PaymentSummary payments={payments} />
                  </Td>
                  <Td>
                    <BookingStatusBadge status={booking.status} />
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {stayBucketLabels[stayBucket(booking, today)]}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>
    </AdminPage>
  );
}

function EmptyState({
  title,
  body,
  action,
  search = false,
}: {
  title: string;
  body: string;
  action: React.ReactNode;
  search?: boolean;
}) {
  const Icon = search ? MagnifyingGlass : CalendarBlank;
  return (
    <div className="flex flex-col items-center gap-3 rounded-[28px] border border-dashed border-border bg-card p-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-stone text-muted-foreground">
        <Icon weight="fill" className="size-5" aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-display text-2xl">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  );
}
