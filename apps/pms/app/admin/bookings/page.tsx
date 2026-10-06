import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarBlank, MagnifyingGlass, PushPin } from '@phosphor-icons/react/dist/ssr';
import { catalogService, guestAppUrl, hotelRepository, inventoryService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { toIsoDate } from '@/lib/application/search-params';
import { nightsBetween } from '@/lib/domain/pricing';
import type { Booking } from '@/lib/domain/schemas';
import type { AdminLocale } from '@/lib/i18n/admin/locale';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lBookingStatus, lDateRange, lGuests, lMoney, lNights, lRoomNumber } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { BookingAddMenu } from '@/components/admin/operations/booking-add-menu';
import { GuestShowcaseButton } from '@/components/admin/operations/guest-showcase-button';
import {
  stayBucket,
  stayBucketKey,
  stayBuckets,
  staysOverlap,
  type StayBucket,
} from '@/components/admin/operations/booking-buckets';
import { BookingDatesFilter } from '@/components/admin/operations/booking-dates-filter';
import { BookingRowActions } from '@/components/admin/operations/booking-row-actions';
import { BookingSearchFilter } from '@/components/admin/operations/booking-search-filter';
import { FilterPills } from '@/components/admin/operations/filter-pills';
import { BookingStatusBadge } from '@/components/admin/operations/booking-status-badge';
import { PAGE_SIZE, paginate, parsePage, parsePageSize, Pagination } from '@/components/admin/operations/pagination';
import { SortableTh, TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { SearchInput } from '@/components/ui/search-input';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('nav.reservations')) };
}

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

interface DayRange {
  from: string;
  to: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** `?from=&to=` as an inclusive range of days: a lone `from` is that one day, a reversed pair is put right. */
function parseRange(fromParam: string | string[] | undefined, toParam: string | string[] | undefined): DayRange | null {
  const from = typeof fromParam === 'string' && ISO_DAY.test(fromParam) ? fromParam : null;
  if (!from) return null;
  const to = typeof toParam === 'string' && ISO_DAY.test(toParam) ? toParam : from;
  return from <= to ? { from, to } : { from: to, to: from };
}

type SortField = 'reference' | 'guest' | 'room' | 'stay' | 'total' | 'status';
type Sort = { field: SortField; dir: 'asc' | 'desc' } | null;

const SORT_FIELDS: readonly SortField[] = ['reference', 'guest', 'room', 'stay', 'total', 'status'];

function parseSort(value: string | string[] | undefined): Sort {
  const [field, dir] = (typeof value === 'string' ? value : '').split(':');
  if (!SORT_FIELDS.includes(field as SortField)) return null;
  return { field: field as SortField, dir: dir === 'asc' ? 'asc' : 'desc' };
}

/** Clicking a column cycles it off → ascending → descending → off, rather than only ever toggling two states. */
function nextSort(current: Sort, field: SortField): Sort {
  if (!current || current.field !== field) return { field, dir: 'asc' };
  return current.dir === 'asc' ? { field, dir: 'desc' } : null;
}

function sortKey(booking: Booking, field: SortField, roomNames: Map<string, string>, locale: AdminLocale): string | number {
  switch (field) {
    case 'reference':
      return booking.reference;
    case 'guest':
      return `${booking.guest.firstName} ${booking.guest.lastName}`.toLowerCase();
    case 'room':
      return (roomNames.get(booking.roomTypeId) ?? booking.roomTypeId).toLowerCase();
    case 'stay':
      return booking.checkIn;
    case 'total':
      return booking.total;
    case 'status':
      return lBookingStatus(booking.status, locale).toLowerCase();
  }
}

/** `null` keeps the list in its default order — newest booking first — rather than re-sorting it. */
function applySort(bookings: Booking[], sort: Sort, roomNames: Map<string, string>, locale: AdminLocale): Booking[] {
  if (!sort) return bookings;
  return [...bookings].sort((a, b) => {
    const av = sortKey(a, sort.field, roomNames, locale);
    const bv = sortKey(b, sort.field, roomNames, locale);
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sort.dir === 'asc' ? cmp : -cmp;
  });
}

function hrefFor(filter: Filter, query: string, range: DayRange | null, sort: Sort, page?: number, pageSize?: number): string {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (filter !== 'all') params.set('status', filter);
  if (range) {
    params.set('from', range.from);
    params.set('to', range.to);
  }
  if (sort) params.set('sort', `${sort.field}:${sort.dir}`);
  if (page && page > 1) params.set('page', String(page));
  if (pageSize && pageSize !== PAGE_SIZE) params.set('pageSize', String(pageSize));
  const search = params.toString();
  return search ? `/admin/bookings?${search}` : '/admin/bookings';
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q.trim() : '';
  const filter = parseFilter(params.status);
  const range = parseRange(params.from, params.to);
  const sort = parseSort(params.sort);
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.pageSize);
  const today = toIsoDate(new Date());

  const [hotel, allBookings] = await Promise.all([
    catalogService.getHotel(await getSelectedHotelSlug()),
    hotelRepository.listBookings(),
  ]);
  const bookings = allBookings.filter((booking) => booking.hotelId === hotel.id);
  const rooms = await hotelRepository.listRooms(hotel.id);
  const roomNames = new Map(rooms.map((room) => [room.id, room.name]));
  const bookableRoomTypes = rooms
    .filter((room) => !room.hidden)
    .map((room) => ({ id: room.id, slug: room.slug, name: room.name }));

  const sorted = [...bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // Search and dates narrow the list first; the status pills then count within what is left.
  const searched = sorted
    .filter((booking) => !query || matches(booking, query))
    .filter((booking) => !range || staysOverlap(booking, range.from, range.to));
  const counts: Record<Filter, number> = { all: searched.length, upcoming: 0, in_house: 0, past: 0, cancelled: 0 };
  for (const booking of searched) counts[stayBucket(booking, today)] += 1;
  const visible = filter === 'all' ? searched : searched.filter((booking) => stayBucket(booking, today) === filter);
  const ordered = applySort(visible, sort, roomNames, locale);
  const { pageItems, page: currentPage, totalPages } = paginate(ordered, page, pageSize);

  const rows = await Promise.all(
    pageItems.map(async (booking) => ({ booking, room: await inventoryService.getBookingRoom(booking) })),
  );

  const filters: Filter[] = ['all', ...stayBuckets];

  return (
    <AdminPage>
      <AdminPageHeader
        title={t('nav.reservations')}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <GuestShowcaseButton />
            <BookingAddMenu roomTypes={bookableRoomTypes} today={today} />
          </div>
        )}
      />

      {/* One row of compact controls on a phone — Filters, Any dates and
          Search each stay their own natural width and wrap only if they
          truly run out of room — rather than each claiming a full-width
          row of its own. Past `lg:`, the original two-slot layout returns:
          status pills on the left, dates and the plain search field on
          the right. */}
      <div className="mt-2 flex flex-wrap items-center gap-2 lg:flex-nowrap lg:justify-between">
        <FilterPills
          label={t('ops.filterByStay')}
          sheetTitle={t('ops.filterReservations')}
          options={filters.map((option) => ({
            key: option,
            label: option === 'all' ? t('bookings.all') : t(stayBucketKey[option]),
            count: counts[option],
            href: hrefFor(option, query, range, sort),
            current: option === filter,
          }))}
        />

        <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
        <BookingDatesFilter from={range?.from ?? null} to={range?.to ?? null} />
        <BookingSearchFilter query={query} suggestions={bookings.map((booking) => ({
          value: booking.reference,
          label: `${booking.guest.firstName} ${booking.guest.lastName}`,
          detail: `${booking.reference} · ${booking.guest.email}`,
        }))} />
        <form role="search" action="/admin/bookings" method="get" className="hidden gap-2 lg:flex lg:w-auto">
          {filter !== 'all' ? <input type="hidden" name="status" value={filter} /> : null}
          {range ? <input type="hidden" name="from" value={range.from} /> : null}
          {range ? <input type="hidden" name="to" value={range.to} /> : null}
          <label htmlFor="bookings-search" className="sr-only">
            {t('ops.searchLabel')}
          </label>
          <SearchInput
            id="bookings-search"
            name="q"
            defaultValue={query}
            suggestions={bookings.map((booking) => ({
              value: booking.reference,
              label: `${booking.guest.firstName} ${booking.guest.lastName}`,
              detail: `${booking.reference} · ${booking.guest.email}`,
            }))}
            suggestionsLabel={t('ops.searchReservations')}
            placeholder={t('ops.searchPlaceholder')}
            wrapperClassName="flex-1 lg:w-56 lg:flex-none"
          />
          <button type="submit" className={pill('primary')}>
            {t('ops.search')}
          </button>
        </form>
        </div>
      </div>

      <div className="mt-6">
        {sorted.length === 0 ? (
          <EmptyState
            title={t('bookings.emptyTitle')}
            body={t('bookings.emptyBody')}
            action={guestAppUrl('/rooms') ? <a href={guestAppUrl('/rooms')!} className={pill('primary')}>{t('ops.makeDemoBooking')}</a> : null}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            search
            title={t('bookings.noMatchTitle')}
            body={
              query
                ? t('bookings.noMatchQuery', { query })
                : range
                  ? t('bookings.noMatchDates')
                  : t('bookings.noMatchView')
            }
            action={
              <Link href="/admin/bookings" className={pill('secondary')}>
                {t('bookings.clearFilters')}
              </Link>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-[18px] bg-card shadow-soft">
          <TableCard caption={t('bookings.tableCaption')} className="min-w-[62rem]" attached>
            <thead>
              <tr className="border-b border-border">
                <SortableTh
                  href={hrefFor(filter, query, range, nextSort(sort, 'reference'), undefined, pageSize)}
                  direction={sort?.field === 'reference' ? sort.dir : undefined}
                >
                  {t('ops.thBookingNumber')}
                </SortableTh>
                <SortableTh
                  href={hrefFor(filter, query, range, nextSort(sort, 'guest'), undefined, pageSize)}
                  direction={sort?.field === 'guest' ? sort.dir : undefined}
                >
                  {t('ops.thGuest')}
                </SortableTh>
                <SortableTh
                  href={hrefFor(filter, query, range, nextSort(sort, 'room'), undefined, pageSize)}
                  direction={sort?.field === 'room' ? sort.dir : undefined}
                >
                  {t('ops.thRoom')}
                </SortableTh>
                <SortableTh
                  href={hrefFor(filter, query, range, nextSort(sort, 'stay'), undefined, pageSize)}
                  direction={sort?.field === 'stay' ? sort.dir : undefined}
                >
                  {t('ops.thStay')}
                </SortableTh>
                <SortableTh
                  href={hrefFor(filter, query, range, nextSort(sort, 'total'), undefined, pageSize)}
                  direction={sort?.field === 'total' ? sort.dir : undefined}
                  align="right"
                >
                  {t('ops.thTotal')}
                </SortableTh>
                <SortableTh
                  href={hrefFor(filter, query, range, nextSort(sort, 'status'), undefined, pageSize)}
                  direction={sort?.field === 'status' ? sort.dir : undefined}
                >
                  {t('ops.thStatus')}
                </SortableTh>
                <Th className="w-14">
                  <span className="sr-only">{t('ops.thActions')}</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ booking, room }) => {
                const canCancel = booking.status === 'confirmed' && booking.checkIn > today;
                const cancelBlockedReason =
                  booking.status === 'cancelled'
                    ? t('bookings.alreadyCancelled')
                    : !canCancel
                      ? t('bookings.stayBegun')
                      : undefined;
                return (
                <tr
                  key={booking.id}
                  className="relative border-b border-border transition-colors last:border-b-0 hover:bg-stone/50"
                >
                  <Td className="whitespace-nowrap">
                    {/* Stretched: the row opens the booking's own page from
                        anywhere in it, not only these six characters — the
                        row menu below sits at a higher stacking level so its
                        own click still reaches it instead of this. */}
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
                  <Td>
                    {roomNames.get(booking.roomTypeId) ?? booking.roomTypeId}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {room ? (
                        booking.status === 'cancelled' ? (
                          t('bookings.roomReleased', { room: lRoomNumber(room.number, locale) })
                        ) : (
                          <>
                            {lRoomNumber(room.number, locale)}
                            {room.chosenByGuest ? (
                              <>
                                <PushPin weight="fill" className="size-3.5 text-foreground" aria-hidden="true" />
                                <span className="sr-only">{t('bookings.chosenByGuestSr')}</span>
                              </>
                            ) : null}
                          </>
                        )
                      ) : (
                        t('bookings.noRoomHeld')
                      )}
                    </span>
                  </Td>
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
                    {booking.status === 'cancelled' && booking.cancellationReason ? (
                      <span className="mt-1 block max-w-56 text-xs text-muted-foreground">{booking.cancellationReason}</span>
                    ) : null}
                  </Td>
                  <Td className="relative z-10 text-right">
                    <BookingRowActions
                      reference={booking.reference}
                      canCancel={canCancel}
                      cancelBlockedReason={cancelBlockedReason}
                    />
                  </Td>
                </tr>
                );
              })}
            </tbody>
          </TableCard>
          <Pagination
            attached
            page={currentPage}
            totalPages={totalPages}
            total={visible.length}
            pageSize={pageSize}
            hrefFor={(next) => hrefFor(filter, query, range, sort, next, pageSize)}
            pageSizeHrefFor={(size) => hrefFor(filter, query, range, sort, 1, size)}
          />
          </div>
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
    <div className="flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-border bg-card p-10 text-center">
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
