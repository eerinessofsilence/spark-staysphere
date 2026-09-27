import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronUpDownIcon } from '@heroicons/react/24/outline';
import { CalendarBlank } from '@phosphor-icons/react/dist/ssr';
import { catalogService, reportsService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { parseReportPeriod } from '@/lib/application/report-period';
import type { StatisticsRow } from '@/lib/application/reports-service';
import { toIsoDate } from '@/lib/application/search-params';
import { isReportType, REPORT_TYPES } from '@/lib/domain/reports';
import type { ReportType } from '@/lib/domain/ports';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lDate, lDateShort, lGuests, lMoney, lRoomNumber } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { DownloadReportPdfButton } from '@/components/admin/accounting/download-report-pdf-button';
import { PrintReportButton } from '@/components/admin/accounting/print-report-button';
import { ReportDateForm } from '@/components/admin/accounting/report-date-form';
import { ReportPeriodFilter } from '@/components/admin/accounting/report-period-filter';
import type { ReportPdfCopy, ReportPdfRow } from '@/components/admin/accounting/report-pdf-document';
import { ReportsTabs } from '@/components/admin/accounting/reports-tabs';
import { SaveReportButton } from '@/components/admin/accounting/save-report-button';
import { HousekeepingStatusBadge } from '@/components/admin/housekeeping/housekeeping-status-badge';
import { PAGE_SIZE, paginate, parsePage, parsePageSize, Pagination } from '@/components/admin/operations/pagination';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('reports.title')) };
}

const REPORT_LABEL: Record<ReportType, AdminTranslationKey> = {
  arrivals: 'reports.arrivals',
  departures: 'reports.departures',
  in_house: 'reports.inHouse',
};

const views = [
  { key: 'manager', label: 'reports.managerAnalytics' },
  { key: 'financial', label: 'reports.financial' },
  { key: 'ledger', label: 'reports.guestLedger' },
  { key: 'daily', label: 'reports.dailyList' },
  { key: 'statistics', label: 'reports.statistics' },
] as const satisfies readonly { key: string; label: AdminTranslationKey }[];
type ReportView = (typeof views)[number]['key'];
type SortKey = 'room' | 'breakfast' | 'checkIn' | 'checkOut' | 'total';

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseView(value: string | string[] | undefined, type: string | undefined): ReportView {
  const raw = first(value);
  if (views.some((option) => option.key === raw)) return raw as ReportView;
  // Old bookmarks with ?type=arrivals still open the same live daily report.
  return type ? 'daily' : 'statistics';
}

function parseType(value: string | undefined): ReportType {
  return value && isReportType(value) ? value : 'arrivals';
}

function parseDate(value: string | undefined, fallback: string): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function sortedRows(rows: StatisticsRow[], sort: SortKey, descending: boolean): StatisticsRow[] {
  const direction = descending ? -1 : 1;
  return [...rows].sort((a, b) => {
    if (sort === 'breakfast') return direction * ((a.booking?.breakfastGuests ?? 0) - (b.booking?.breakfastGuests ?? 0));
    if (sort === 'total') return direction * ((a.booking?.total ?? 0) - (b.booking?.total ?? 0));
    if (sort === 'checkIn') return direction * (a.booking?.checkIn ?? '').localeCompare(b.booking?.checkIn ?? '');
    if (sort === 'checkOut') return direction * (a.booking?.checkOut ?? '').localeCompare(b.booking?.checkOut ?? '');
    return direction * (a.roomNumber ?? '').localeCompare(b.roomNumber ?? '', undefined, { numeric: true });
  });
}

const tableGrid = '[&_th:not(:last-child)]:border-r [&_td:not(:last-child)]:border-r [&_th]:border-border [&_td]:border-border';

/** Live report workspace: category, period and result all stay in the URL. */
export default async function AccountingReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const sp = await searchParams;
  const today = toIsoDate(new Date());
  const type = parseType(first(sp.type));
  const view = parseView(sp.view, first(sp.type));
  const date = parseDate(first(sp.date), today);
  const period = parseReportPeriod(sp.period, sp.from, sp.to, today);
  const page = parsePage(sp.page);
  const pageSize = parsePageSize(sp.pageSize);
  const sort: SortKey = ['room', 'breakfast', 'checkIn', 'checkOut', 'total'].includes(first(sp.sort) ?? '')
    ? first(sp.sort) as SortKey
    : 'room';
  const descending = first(sp.dir) === 'desc';
  const hotelSlug = await getSelectedHotelSlug();
  const [hotel, dailyMatches, periodReport, liveStatisticsRows] = await Promise.all([
    catalogService.getHotel(hotelSlug),
    view === 'daily' ? reportsService.query(hotelSlug, type, date) : Promise.resolve([]),
    view !== 'daily' && view !== 'statistics' ? reportsService.queryPeriod(hotelSlug, period.from, period.to) : Promise.resolve(null),
    view === 'statistics' ? reportsService.queryStatistics(hotelSlug, period.from, period.to, today) : Promise.resolve([]),
  ]);
  const periodRows = periodReport?.rows ?? [];
  const statisticsRows = sortedRows(liveStatisticsRows, sort, descending);
  const sourceRows = view === 'daily' ? dailyMatches : periodRows;
  const { pageItems: rows, page: currentPage, totalPages } = paginate(sourceRows, page, pageSize);
  const { pageItems: statisticRows, page: statisticPage, totalPages: statisticPages } = paginate(statisticsRows, page, pageSize);

  const pdfRows: ReportPdfRow[] = dailyMatches.map((row) => ({
    guestName: `${row.guestFirstName} ${row.guestLastName}`,
    guestEmail: row.guestEmail,
    roomTypeName: row.roomTypeName,
    roomNumber: row.roomNumber ? lRoomNumber(row.roomNumber, locale) : t('booking.notAssigned'),
    checkIn: lDate(row.checkIn, locale),
    checkOut: lDate(row.checkOut, locale),
    guests: lGuests(row.adults, row.children, locale),
    total: lMoney(row.total, row.currency, locale),
  }));
  const pdfCopy: ReportPdfCopy = {
    title: t(REPORT_LABEL[type]),
    subtitle: `${hotel.name} · ${lDate(date, locale)}`,
    note: null,
    thGuest: t('ops.thGuest'),
    thRoom: t('ops.thRoom'),
    thCheckIn: t('ops.thCheckIn'),
    thCheckOut: t('ops.thCheckOut'),
    thGuests: t('ops.thGuests'),
    thTotal: t('ops.thTotal'),
    noResults: t('reports.noResults'),
  };

  const pageHref = (overrides: Partial<{ view: ReportView; type: ReportType; date: string; page: number; pageSize: number; sort: SortKey; dir: 'asc' | 'desc' }>) => {
    const next = { view, type, date, page: currentPage, pageSize, sort, dir: descending ? 'desc' as const : 'asc' as const, ...overrides };
    const query = new URLSearchParams({ view: next.view });
    if (next.view === 'daily') {
      query.set('type', next.type);
      query.set('date', next.date);
    } else {
      query.set('period', period.key);
      if (period.key === 'custom') {
        query.set('from', period.from);
        query.set('to', period.to);
      }
    }
    if (next.page > 1) query.set('page', String(next.page));
    if (next.pageSize !== PAGE_SIZE) query.set('pageSize', String(next.pageSize));
    if (next.view === 'statistics' && next.sort !== 'room') query.set('sort', next.sort);
    if (next.view === 'statistics' && next.dir === 'desc') query.set('dir', 'desc');
    return `/admin/accounting/reports?${query.toString()}`;
  };
  const sortHeading = (key: SortKey, label: string) => (
    <Link
      href={pageHref({ sort: key, dir: sort === key && !descending ? 'desc' : 'asc', page: 1 })}
      className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground hover:text-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      aria-label={`${label}, ${sort === key && !descending ? 'descending' : 'ascending'}`}
    >
      {label}<ChevronUpDownIcon className="size-3.5" aria-hidden="true" />
    </Link>
  );

  const heading = view === 'daily' ? t(REPORT_LABEL[type]) : view === 'statistics' ? t('reports.housekeepingMeals') : t(views.find((item) => item.key === view)!.label);
  const rowCount = view === 'manager' ? periodReport?.roomTypes.length ?? 0 : view === 'statistics' ? statisticsRows.length : sourceRows.length;

  return (
    <AdminPage>
      <AdminPageHeader title={t('reports.title')} />
      <ReportsTabs current="online" />

      <section className="rounded-[18px] rounded-tl-none border border-border bg-card shadow-soft print:hidden" aria-label={t('reports.tabOnline')}>
        <nav aria-label={t('reports.reportType')} className="overflow-x-auto contain-inline-size border-b border-border px-4 sm:px-6">
          <ul className="flex w-max min-w-full items-center gap-1">
            {views.map((item) => (
              <li key={item.key}>
                <Link
                  href={pageHref({ view: item.key, page: 1 })}
                  aria-current={view === item.key ? 'page' : undefined}
                  className={`flex min-h-14 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors sm:px-4 ${view === item.key ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  {t(item.label)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-5 sm:p-6">
          {view === 'daily' ? (
            <>
              <h2 className="text-base font-medium">{t('reports.reportType')}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {REPORT_TYPES.map((option) => (
                  <Link key={option} href={pageHref({ type: option, page: 1 })} aria-current={option === type ? 'true' : undefined} className={pill(option === type ? 'primary' : 'secondary', 'min-h-10 px-4 text-sm')}>
                    {t(REPORT_LABEL[option])}
                  </Link>
                ))}
              </div>
              <ReportDateForm type={type} date={date} />
            </>
          ) : (
            <ReportPeriodFilter view={view} period={period} locale={locale} />
          )}
        </div>
      </section>

      <section id="report-printable" className="mt-5" aria-labelledby="report-result-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="report-result-heading" className="text-display text-xl sm:text-2xl">{heading}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {hotel.name} · {view === 'daily' ? lDate(date, locale) : `${lDateShort(period.from, locale)}${period.from === period.to ? '' : ` – ${lDateShort(period.to, locale)}`}`}
            </p>
            {view === 'statistics' ? <p className="mt-1 text-xs text-muted-foreground">{t('reports.currentDataNote')}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            {view === 'daily' ? (
              <>
                <SaveReportButton type={type} date={date} />
                <DownloadReportPdfButton hotelName={hotel.name} copy={pdfCopy} rows={pdfRows} filename={`report-${type}-${date}.pdf`} />
              </>
            ) : null}
            <PrintReportButton disabled={rowCount === 0} />
          </div>
        </div>

        {rowCount === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-border bg-card p-10 text-center">
            <CalendarBlank weight="fill" className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{view === 'daily' ? t('reports.noResults') : view === 'manager' ? t('reports.noRoomTypes') : t('reports.noPeriodRows')}</p>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-[18px] border border-border bg-card shadow-soft">
            {view === 'manager' ? (
              <TableCard caption={heading} className={`min-w-[42rem] ${tableGrid}`} attached>
                <thead className="bg-stone/50"><tr className="border-b border-border">
                  <Th>{t('reports.roomType')}</Th><Th className="text-right">{t('reports.rooms')}</Th><Th className="text-right">{t('reports.occupiedNights')}</Th><Th className="text-right">{t('reports.occupancy')}</Th><Th className="text-right">{t('reports.bookedValue')}</Th>
                </tr></thead>
                <tbody>{periodReport?.roomTypes.map((room) => (
                  <tr key={room.id} className="border-b border-border last:border-0 hover:bg-stone/30">
                    <Td className="font-medium">{room.name}</Td><Td className="text-right tabular-nums">{room.rooms}</Td><Td className="text-right tabular-nums">{room.occupiedNights}</Td><Td className="text-right tabular-nums">{room.availableNights ? `${Math.min(100, Math.round(room.occupiedNights / room.availableNights * 100))}%` : '—'}</Td><Td className="text-right tabular-nums whitespace-nowrap">{Object.entries(room.bookingValues).length ? Object.entries(room.bookingValues).map(([currency, amount]) => lMoney(amount, currency as typeof hotel.currency, locale)).join(' · ') : '—'}</Td>
                  </tr>
                ))}</tbody>
              </TableCard>
            ) : view === 'daily' ? (
              <TableCard caption={heading} className={`min-w-[52rem] ${tableGrid}`} attached>
                <thead className="bg-stone/50"><tr className="border-b border-border">
                  <Th>{t('ops.thGuest')}</Th><Th>{t('ops.thRoom')}</Th><Th>{t('ops.thCheckIn')}</Th><Th>{t('ops.thCheckOut')}</Th><Th>{t('ops.thGuests')}</Th><Th className="text-right">{t('ops.thTotal')}</Th>
                </tr></thead>
                <tbody>{rows.map((row) => (
                  <tr key={row.bookingId} className="border-b border-border last:border-0 hover:bg-stone/30">
                    <Td className="font-medium">{row.guestFirstName} {row.guestLastName}<span className="block text-xs font-normal text-muted-foreground">{row.guestEmail}</span></Td>
                    <Td className="whitespace-nowrap">{row.roomTypeName}<span className="block text-xs text-muted-foreground">{row.roomNumber ? lRoomNumber(row.roomNumber, locale) : t('booking.notAssigned')}</span></Td>
                    <Td className="whitespace-nowrap">{lDateShort(row.checkIn, locale)}</Td><Td className="whitespace-nowrap">{lDateShort(row.checkOut, locale)}</Td>
                    <Td className="whitespace-nowrap">{lGuests(row.adults, row.children, locale)}</Td><Td className="text-right tabular-nums whitespace-nowrap">{lMoney(row.total, row.currency, locale)}</Td>
                  </tr>
                ))}</tbody>
              </TableCard>
            ) : view === 'statistics' ? (
              <TableCard caption={heading} className={`min-w-[62rem] ${tableGrid}`} attached>
                <thead className="bg-stone/50"><tr className="border-b border-border">
                  <Th>{sortHeading('room', t('ops.thRoom'))}</Th><Th>{t('reports.reference')}</Th><Th>{sortHeading('breakfast', t('reports.breakfast'))}</Th><Th>{sortHeading('checkIn', t('ops.thCheckIn'))}</Th><Th>{sortHeading('checkOut', t('ops.thCheckOut'))}</Th><Th>{t('reports.comment')}</Th><Th className="text-right">{sortHeading('total', t('reports.stayTotal'))}</Th>
                </tr></thead>
                <tbody>{statisticRows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0 hover:bg-stone/30">
                    <Td className="font-medium whitespace-nowrap">{row.roomNumber ? lRoomNumber(row.roomNumber, locale) : t('booking.notAssigned')}</Td>
                    <Td className="tabular-nums">{row.booking?.reference ?? '—'}</Td>
                    <Td className="tabular-nums">{row.booking?.breakfastGuests || '—'}</Td>
                    <Td className="whitespace-nowrap">{row.booking ? lDateShort(row.booking.checkIn, locale) : '—'}</Td>
                    <Td className="whitespace-nowrap">{row.booking ? lDateShort(row.booking.checkOut, locale) : '—'}</Td>
                    <Td className="min-w-48 max-w-72">
                      <div className="flex flex-col items-start gap-1.5">
                        {row.status ? <HousekeepingStatusBadge status={row.status} /> : null}
                        {row.note ? <span className="text-muted-foreground">{row.note}</span> : null}
                        {row.booking?.diningItems.length ? <span className="text-muted-foreground">{t('reports.dining')}: {row.booking.diningItems.join(', ')}</span> : null}
                        {!row.status && !row.note && !row.booking?.diningItems.length ? '—' : null}
                      </div>
                    </Td>
                    <Td className="text-right tabular-nums whitespace-nowrap">{row.booking ? lMoney(row.booking.total, row.booking.currency, locale) : '—'}</Td>
                  </tr>
                ))}</tbody>
              </TableCard>
            ) : view === 'financial' ? (
              <TableCard caption={heading} className={`min-w-[53rem] ${tableGrid}`} attached>
                <thead className="bg-stone/50"><tr className="border-b border-border">
                  <Th>{t('reports.reference')}</Th><Th>{t('ops.thGuest')}</Th><Th>{t('ops.thRoom')}</Th><Th>{t('ops.thCheckIn')}</Th><Th>{t('ops.thCheckOut')}</Th><Th className="text-right">{t('reports.stayTotal')}</Th>
                </tr></thead>
                <tbody>{rows.map((row) => (
                  <tr key={row.bookingId} className="border-b border-border last:border-0 hover:bg-stone/30">
                    <Td className="font-medium tabular-nums">{row.reference}</Td><Td>{row.guestFirstName} {row.guestLastName}</Td><Td className="whitespace-nowrap">{row.roomNumber ? lRoomNumber(row.roomNumber, locale) : row.roomTypeName}</Td><Td className="whitespace-nowrap">{lDateShort(row.checkIn, locale)}</Td><Td className="whitespace-nowrap">{lDateShort(row.checkOut, locale)}</Td><Td className="text-right tabular-nums whitespace-nowrap">{lMoney(row.total, row.currency, locale)}</Td>
                  </tr>
                ))}</tbody>
              </TableCard>
            ) : (
              <TableCard caption={heading} className={`min-w-[56rem] ${tableGrid}`} attached>
                <thead className="bg-stone/50"><tr className="border-b border-border">
                  <Th>{t('ops.thGuest')}</Th><Th>{t('reports.reference')}</Th><Th>{t('ops.thRoom')}</Th><Th>{t('ops.thGuests')}</Th><Th>{t('ops.thCheckIn')}</Th><Th>{t('ops.thCheckOut')}</Th><Th className="text-right">{t('reports.stayTotal')}</Th>
                </tr></thead>
                <tbody>{rows.map((row) => (
                  <tr key={row.bookingId} className="border-b border-border last:border-0 hover:bg-stone/30">
                    <Td className="font-medium">{row.guestFirstName} {row.guestLastName}<span className="block text-xs font-normal text-muted-foreground">{row.guestEmail}</span></Td><Td className="tabular-nums">{row.reference}</Td><Td className="whitespace-nowrap">{row.roomNumber ? lRoomNumber(row.roomNumber, locale) : row.roomTypeName}</Td><Td className="whitespace-nowrap">{lGuests(row.adults, row.children, locale)}</Td><Td className="whitespace-nowrap">{lDateShort(row.checkIn, locale)}</Td><Td className="whitespace-nowrap">{lDateShort(row.checkOut, locale)}</Td><Td className="text-right tabular-nums whitespace-nowrap">{lMoney(row.total, row.currency, locale)}</Td>
                  </tr>
                ))}</tbody>
              </TableCard>
            )}
            {view !== 'manager' ? (
              <div className="print:hidden"><Pagination attached page={view === 'statistics' ? statisticPage : currentPage} totalPages={view === 'statistics' ? statisticPages : totalPages} total={view === 'statistics' ? statisticsRows.length : sourceRows.length} pageSize={pageSize} hrefFor={(p) => pageHref({ page: p })} pageSizeHrefFor={(size) => pageHref({ pageSize: size, page: 1 })} /></div>
            ) : null}
          </div>
        )}
      </section>
    </AdminPage>
  );
}
