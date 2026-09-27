import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronUpDownIcon } from '@heroicons/react/24/outline';
import { ClockCounterClockwise } from '@phosphor-icons/react/dist/ssr';
import { catalogService, reportsService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import type { GeneratedReport, GeneratedReportKind } from '@/lib/domain/ports';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lDate, lDateShort, lGuests, lMoney, lRoomNumber } from '@/lib/i18n/format';
import type { ReportPdfCopy, ReportPdfRow } from '@/components/admin/accounting/report-pdf-document';
import { ReportRowActions } from '@/components/admin/accounting/report-row-actions';
import { ReportsTabs } from '@/components/admin/accounting/reports-tabs';
import { SampleReportsButton } from '@/components/admin/accounting/sample-reports-button';
import { PAGE_SIZE, paginate, parsePage, parsePageSize, Pagination } from '@/components/admin/operations/pagination';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('reports.title')) };
}

const REPORT_LABEL: Record<GeneratedReportKind, AdminTranslationKey> = {
  arrivals: 'reports.arrivals',
  departures: 'reports.departures',
  in_house: 'reports.inHouse',
  manager: 'reports.managerAnalytics',
  financial: 'reports.financial',
  ledger: 'reports.guestLedger',
  statistics: 'reports.statistics',
};

/** A daily report's guest rows, or a period one's room types/rooms — whichever `report.type` populated. */
function rowCountOf(report: GeneratedReport): number {
  if (report.type === 'manager') return report.roomTypeRows?.length ?? 0;
  if (report.type === 'statistics') return report.statisticsRows?.length ?? 0;
  return report.rows.length;
}

type SortKey = 'generatedAt' | 'type' | 'date' | 'generatedBy' | 'rows';
const SORT_KEYS: readonly SortKey[] = ['generatedAt', 'type', 'date', 'generatedBy', 'rows'];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function sortedReports(
  reports: GeneratedReport[],
  sort: SortKey,
  descending: boolean,
  typeLabel: (type: GeneratedReportKind) => string,
): GeneratedReport[] {
  const compare = (a: GeneratedReport, b: GeneratedReport): number => {
    switch (sort) {
      case 'generatedAt':
        return a.generatedAt.localeCompare(b.generatedAt);
      case 'type':
        return typeLabel(a.type).localeCompare(typeLabel(b.type));
      case 'date':
        return a.date.localeCompare(b.date);
      case 'generatedBy':
        return a.generatedBy.localeCompare(b.generatedBy);
      case 'rows':
        return rowCountOf(a) - rowCountOf(b);
    }
  };
  const sorted = [...reports].sort(compare);
  return descending ? sorted.reverse() : sorted;
}

/**
 * The "Generated" tab: past runs of the same query the "Online" tab makes
 * live, each one frozen at the moment someone generated it — a report a
 * team member can reopen without re-running it against whatever the
 * bookings look like today. See `reports-service.ts`.
 */
export default async function GeneratedReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const pageSize = parsePageSize(sp.pageSize);
  const sort: SortKey = SORT_KEYS.includes(first(sp.sort) as SortKey) ? (first(sp.sort) as SortKey) : 'generatedAt';
  const descending = first(sp.dir) === 'asc' ? false : first(sp.dir) === 'desc' ? true : sort === 'generatedAt';
  const hotelSlug = await getSelectedHotelSlug();
  const [hotel, reports] = await Promise.all([catalogService.getHotel(hotelSlug), reportsService.list(hotelSlug)]);
  const sorted = sortedReports(reports, sort, descending, (type) => t(REPORT_LABEL[type]));
  const { pageItems, page: currentPage, totalPages } = paginate(sorted, page, pageSize);

  // The row menu renders the PDF in the browser from strings formatted here,
  // the same ones the report's own page shows — see `report-pdf-client.ts`.
  const pdfRowsOf = (report: GeneratedReport): ReportPdfRow[] =>
    report.rows.map((row) => ({
      guestName: `${row.guestFirstName} ${row.guestLastName}`,
      guestEmail: row.guestEmail,
      roomTypeName: row.roomTypeName,
      roomNumber: row.roomNumber ? lRoomNumber(row.roomNumber, locale) : t('booking.notAssigned'),
      checkIn: lDate(row.checkIn, locale),
      checkOut: lDate(row.checkOut, locale),
      guests: lGuests(row.adults, row.children, locale),
      total: lMoney(row.total, row.currency, locale),
    }));
  const pdfCopyOf = (report: GeneratedReport): ReportPdfCopy => ({
    title: t(REPORT_LABEL[report.type]),
    subtitle: `${hotel.name} · ${lDate(report.date, locale)}${report.to && report.to !== report.date ? ` – ${lDate(report.to, locale)}` : ''}`,
    note: t('reports.generatedNote', { date: lDate(report.generatedAt.slice(0, 10), locale), name: report.generatedBy }),
    thGuest: t('ops.thGuest'),
    thRoom: t('ops.thRoom'),
    thCheckIn: t('ops.thCheckIn'),
    thCheckOut: t('ops.thCheckOut'),
    thGuests: t('ops.thGuests'),
    thTotal: t('ops.thTotal'),
    noResults: t('reports.noResults'),
  });

  const pageHref = (overrides: Partial<{ page: number; pageSize: number; sort: SortKey; dir: 'asc' | 'desc' }>) => {
    const next = { page: currentPage, pageSize, sort, dir: descending ? ('desc' as const) : ('asc' as const), ...overrides };
    const query = new URLSearchParams();
    if (next.page > 1) query.set('page', String(next.page));
    if (next.pageSize !== PAGE_SIZE) query.set('pageSize', String(next.pageSize));
    if (next.sort !== 'generatedAt') query.set('sort', next.sort);
    const defaultDescending = next.sort === 'generatedAt';
    if ((next.dir === 'desc') !== defaultDescending) query.set('dir', next.dir);
    const qs = query.toString();
    return `/admin/accounting/reports/generated${qs ? `?${qs}` : ''}`;
  };
  const sortHeading = (key: SortKey, label: string) => (
    <Link
      href={pageHref({ sort: key, dir: sort === key && !descending ? 'desc' : 'asc', page: 1 })}
      className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground hover:text-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      aria-label={`${label}, ${sort === key && !descending ? 'descending' : 'ascending'}`}
    >
      {label}
      <ChevronUpDownIcon className="size-3.5" aria-hidden="true" />
    </Link>
  );

  return (
    <AdminPage>
      <AdminPageHeader title={t('reports.title')} />
      <ReportsTabs current="generated" />

      <section aria-labelledby="generated-reports-heading">
        <h2 id="generated-reports-heading" className="sr-only">
          {t('reports.tabGenerated')}
        </h2>
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[18px] rounded-tl-none border border-dashed border-border bg-card p-10 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-stone text-muted-foreground">
              <ClockCounterClockwise weight="fill" className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium">{t('reports.generatedEmpty')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t('reports.generatedEmptyBody')}</p>
            <div className="mt-1">
              <SampleReportsButton />
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[18px] rounded-tl-none bg-card shadow-soft">
            <TableCard caption={t('reports.tabGenerated')} className="min-w-[40rem]" attached>
              <thead>
                <tr className="border-b border-border">
                  <Th>{sortHeading('generatedAt', t('reports.thGeneratedAt'))}</Th>
                  <Th>{sortHeading('type', t('reports.reportType'))}</Th>
                  <Th>{sortHeading('date', t('reports.date'))}</Th>
                  <Th>{sortHeading('generatedBy', t('reports.thGeneratedBy'))}</Th>
                  <Th className="text-right">{sortHeading('rows', t('reports.thRows'))}</Th>
                  <Th>
                    <span className="sr-only">{t('reports.thActions')}</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((report) => (
                  <tr
                    key={report.id}
                    className="relative border-b border-border transition-colors last:border-b-0 hover:bg-stone/50"
                  >
                    <Td className="whitespace-nowrap">
                      <Link
                        href={`/admin/accounting/reports/generated/${report.id}`}
                        className="font-medium hover:text-accent-strong before:absolute before:inset-0"
                      >
                        {lDateShort(report.generatedAt.slice(0, 10), locale)}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap">{t(REPORT_LABEL[report.type])}</Td>
                    <Td className="whitespace-nowrap">
                      {lDateShort(report.date, locale)}
                      {report.to && report.to !== report.date ? ` – ${lDateShort(report.to, locale)}` : ''}
                    </Td>
                    <Td className="whitespace-nowrap">{report.generatedBy}</Td>
                    <Td className="text-right tabular-nums whitespace-nowrap">{rowCountOf(report)}</Td>
                    {/* Above the row's overlay link, so the menu's own click reaches it. */}
                    <Td className="relative z-10 w-12 text-right">
                      <ReportRowActions
                        label={`${t(REPORT_LABEL[report.type])} · ${lDateShort(report.date, locale)}`}
                        href={`/admin/accounting/reports/generated/${report.id}`}
                        hotelName={hotel.name}
                        copy={pdfCopyOf(report)}
                        rows={pdfRowsOf(report)}
                        filename={`report-${report.type}-${report.date}.pdf`}
                      />
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
              hrefFor={(p) => pageHref({ page: p })}
              pageSizeHrefFor={(size) => pageHref({ pageSize: size, page: 1 })}
            />
          </div>
        )}
      </section>
    </AdminPage>
  );
}
