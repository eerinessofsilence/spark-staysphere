import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarBlank } from '@phosphor-icons/react/dist/ssr';
import { catalogService, hotelRepository, inventoryService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { toIsoDate } from '@/lib/application/search-params';
import type { Booking } from '@/lib/domain/schemas';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lDate, lGuests, lMoney, lRoomNumber } from '@/lib/i18n/format';
import { fieldClass, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { AccountingTabs } from '@/components/admin/accounting/accounting-tabs';
import { PrintReportButton } from '@/components/admin/accounting/print-report-button';
import { PAGE_SIZE, paginate, parsePage, parsePageSize, Pagination } from '@/components/admin/operations/pagination';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('reports.title')) };
}

const REPORT_TYPES = ['arrivals', 'departures', 'in_house'] as const;
type ReportType = (typeof REPORT_TYPES)[number];

const REPORT_LABEL: Record<ReportType, AdminTranslationKey> = {
  arrivals: 'reports.arrivals',
  departures: 'reports.departures',
  in_house: 'reports.inHouse',
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function parseType(value: string | string[] | undefined): ReportType {
  const raw = Array.isArray(value) ? value[0] : value;
  return (REPORT_TYPES as readonly string[]).includes(raw ?? '') ? (raw as ReportType) : 'arrivals';
}

function parseDate(value: string | string[] | undefined, fallback: string): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' && ISO_DAY.test(raw) ? raw : fallback;
}

function matchesReport(booking: Booking, type: ReportType, date: string): boolean {
  if (booking.status === 'cancelled') return false;
  switch (type) {
    case 'arrivals':
      return booking.checkIn === date;
    case 'departures':
      return booking.checkOut === date;
    case 'in_house':
      return booking.checkIn <= date && date < booking.checkOut;
  }
}

/**
 * The team's own daily paperwork: who is arriving, leaving, or already in
 * house on a given date, formatted to print or hand to the desk — the same
 * bookings the ledger tracks, sliced by date and stay rather than by
 * payment. Report and date both live in the URL, like every other admin
 * filter, so a printed or bookmarked report is just its own link.
 */
export default async function AccountingReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const sp = await searchParams;
  const today = toIsoDate(new Date());
  const type = parseType(sp.type);
  const date = parseDate(sp.date, today);
  const page = parsePage(sp.page);
  const pageSize = parsePageSize(sp.pageSize);

  const [hotel, allBookings] = await Promise.all([
    catalogService.getHotel(await getSelectedHotelSlug()),
    hotelRepository.listBookings(),
  ]);
  const rooms = await hotelRepository.listRooms(hotel.id);
  const roomNames = new Map(rooms.map((room) => [room.id, room.name]));

  const matches = allBookings
    .filter((booking) => booking.hotelId === hotel.id)
    .filter((booking) => matchesReport(booking, type, date))
    .sort((a, b) => a.guest.lastName.localeCompare(b.guest.lastName));
  const { pageItems, page: currentPage, totalPages } = paginate(matches, page, pageSize);
  const rows = await Promise.all(
    pageItems.map(async (booking) => ({ booking, room: await inventoryService.getBookingRoom(booking) })),
  );

  const pageHref = (overrides: Partial<{ type: ReportType; date: string; page: number; pageSize: number }>) => {
    const next = { type, date, page: currentPage, pageSize, ...overrides };
    const query = new URLSearchParams();
    query.set('type', next.type);
    query.set('date', next.date);
    if (next.page > 1) query.set('page', String(next.page));
    if (next.pageSize !== PAGE_SIZE) query.set('pageSize', String(next.pageSize));
    return `/admin/accounting/reports?${query.toString()}`;
  };

  return (
    <AdminPage>
      <AdminPageHeader title={t('nav.accounting')} />
      <AccountingTabs current="reports" />

      <div className="mt-8 rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
        <h2 className="text-base font-medium">{t('reports.reportType')}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {REPORT_TYPES.map((option) => (
            <Link
              key={option}
              href={pageHref({ type: option, page: 1 })}
              aria-current={option === type ? 'page' : undefined}
              className={pill(option === type ? 'primary' : 'secondary')}
            >
              {t(REPORT_LABEL[option])}
            </Link>
          ))}
        </div>

        <form action="/admin/accounting/reports" method="get" className="mt-6 flex flex-wrap items-end gap-3">
          <input type="hidden" name="type" value={type} />
          <div>
            <label htmlFor="report-date" className="mb-1.5 block text-sm text-muted-foreground">
              {t('reports.date')}
            </label>
            <input id="report-date" name="date" type="date" defaultValue={date} className={cn(fieldClass, 'h-11')} />
          </div>
          <button type="submit" className={pill('primary')}>
            {t('reports.generate')}
          </button>
        </form>
      </div>

      <div id="report-printable" className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-display text-2xl sm:text-3xl">{t(REPORT_LABEL[type])}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {hotel.name} · {lDate(date, locale)}
            </p>
          </div>
          <div className="print:hidden">
            <PrintReportButton />
          </div>
        </div>

        {matches.length === 0 ? (
          <div className="mt-5 flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-border bg-card p-10 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-stone text-muted-foreground">
              <CalendarBlank weight="fill" className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm text-muted-foreground">{t('reports.noResults')}</p>
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-[18px] bg-card shadow-soft">
            <TableCard caption={t(REPORT_LABEL[type])} className="min-w-[48rem]" attached>
              <thead>
                <tr className="border-b border-border">
                  <Th>{t('ops.thGuest')}</Th>
                  <Th>{t('ops.thRoom')}</Th>
                  <Th>{t('ops.thCheckIn')}</Th>
                  <Th>{t('ops.thCheckOut')}</Th>
                  <Th>{t('ops.thGuests')}</Th>
                  <Th className="text-right">{t('ops.thTotal')}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ booking, room }) => (
                  <tr key={booking.id} className="border-b border-border last:border-b-0">
                    <Td>
                      {booking.guest.firstName} {booking.guest.lastName}
                      <span className="block text-xs text-muted-foreground">{booking.guest.email}</span>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {roomNames.get(booking.roomTypeId) ?? booking.roomTypeId}
                      <span className="block text-xs text-muted-foreground">
                        {room ? lRoomNumber(room.number, locale) : t('booking.notAssigned')}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap">{lDate(booking.checkIn, locale)}</Td>
                    <Td className="whitespace-nowrap">{lDate(booking.checkOut, locale)}</Td>
                    <Td className="whitespace-nowrap">{lGuests(booking.adults, booking.children, locale)}</Td>
                    <Td className="text-right tabular-nums whitespace-nowrap">
                      {lMoney(booking.total, booking.currency, locale)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
            <div className="print:hidden">
              <Pagination
                attached
                page={currentPage}
                totalPages={totalPages}
                total={matches.length}
                pageSize={pageSize}
                hrefFor={(p) => pageHref({ page: p })}
                pageSizeHrefFor={(size) => pageHref({ pageSize: size, page: 1 })}
              />
            </div>
          </div>
        )}
      </div>
    </AdminPage>
  );
}
