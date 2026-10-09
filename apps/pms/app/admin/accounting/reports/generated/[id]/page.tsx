import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CalendarBlank } from '@phosphor-icons/react/dist/ssr';
import { catalogService, reportsService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import type { GeneratedReport, GeneratedReportKind } from '@/lib/domain/ports';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lDate, lDateShort, lGuests, lMoney, lRoomNumber } from '@/lib/i18n/format';
import { DownloadReportPdfButton } from '@/components/admin/accounting/download-report-pdf-button';
import { PrintReportButton } from '@/components/admin/accounting/print-report-button';
import type { ReportPdfCopy, ReportPdfRow } from '@/components/admin/accounting/report-pdf-document';
import { HousekeepingStatusBadge } from '@/components/admin/housekeeping/housekeeping-status-badge';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader, type AdminCrumb } from '@/components/admin/shell/admin-page';

export const dynamic = 'force-dynamic';

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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  const report = await reportsService.get(await getSelectedHotelSlug(), (await params).id);
  return { title: adminPageTitle(t, report ? t(REPORT_LABEL[report.type]) : t('reports.title')) };
}

/**
 * One frozen row from the "Generated" tab's grid, reopened: what the report
 * said at the moment someone generated it, not what the same query returns
 * today — see `reports-service.ts`.
 */
export default async function GeneratedReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const [hotel, report] = await Promise.all([
    catalogService.getHotel(await getSelectedHotelSlug()),
    reportsService.get(await getSelectedHotelSlug(), id),
  ]);
  if (!report) notFound();

  const breadcrumbs: AdminCrumb[] = [{ label: t('reports.tabGenerated'), href: '/admin/accounting/reports/generated' }];
  const generatedNote = t('reports.generatedNote', {
    date: lDate(report.generatedAt.slice(0, 10), locale),
    name: report.generatedBy,
  });
  const period = `${lDate(report.date, locale)}${report.to && report.to !== report.date ? ` – ${lDate(report.to, locale)}` : ''}`;
  const isPeriodRows = report.type === 'financial' || report.type === 'ledger';
  const pdfRows: ReportPdfRow[] = report.type === 'manager' || report.type === 'statistics'
    ? []
    : report.rows.map((row) => ({
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
    title: t(REPORT_LABEL[report.type]),
    subtitle: `${hotel.name} · ${period}`,
    note: generatedNote,
    thGuest: t('ops.thGuest'),
    thRoom: t('ops.thRoom'),
    thCheckIn: t('ops.thCheckIn'),
    thCheckOut: t('ops.thCheckOut'),
    thGuests: t('ops.thGuests'),
    thTotal: t('ops.thTotal'),
    noResults: t('reports.noResults'),
  };
  const rowCount = rowCountOf(report);

  return (
    <AdminPage>
      <AdminPageHeader breadcrumbs={breadcrumbs} title={t(REPORT_LABEL[report.type])} />

      <div id="report-printable" className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {/* The page's own title already says this (`AdminPageHeader` above) — this heading only
                exists for the printed page, which shows nothing outside `#report-printable`. */}
            <h2 className="hidden text-display text-2xl sm:text-3xl print:block">{t(REPORT_LABEL[report.type])}</h2>
            <p className="text-sm text-muted-foreground print:mt-1">
              {hotel.name} · {period}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{generatedNote}</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <DownloadReportPdfButton
              hotelName={hotel.name}
              logoUrl={hotel.logo?.url}
              copy={pdfCopy}
              rows={pdfRows}
              filename={`report-${report.type}-${report.date}.pdf`}
            />
            <PrintReportButton disabled={rowCount === 0} />
          </div>
        </div>

        {rowCount === 0 ? (
          <div className="mt-5 flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-border bg-card p-10 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-stone text-muted-foreground">
              <CalendarBlank weight="fill" className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm text-muted-foreground">{t('reports.noResults')}</p>
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-[18px] bg-card shadow-soft">
            {report.type === 'manager' ? (
              <TableCard caption={t(REPORT_LABEL[report.type])} className="min-w-[42rem]" attached>
                <thead>
                  <tr className="border-b border-border">
                    <Th>{t('reports.roomType')}</Th>
                    <Th className="text-right">{t('reports.rooms')}</Th>
                    <Th className="text-right">{t('reports.occupiedNights')}</Th>
                    <Th className="text-right">{t('reports.occupancy')}</Th>
                    <Th className="text-right">{t('reports.bookedValue')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {report.roomTypeRows?.map((room) => (
                    <tr key={room.id} className="border-b border-border last:border-b-0">
                      <Td className="font-medium">{room.name}</Td>
                      <Td className="text-right tabular-nums">{room.rooms}</Td>
                      <Td className="text-right tabular-nums">{room.occupiedNights}</Td>
                      <Td className="text-right tabular-nums">
                        {room.availableNights ? `${Math.min(100, Math.round((room.occupiedNights / room.availableNights) * 100))}%` : '—'}
                      </Td>
                      <Td className="text-right tabular-nums whitespace-nowrap">
                        {Object.entries(room.bookingValues).length
                          ? Object.entries(room.bookingValues).map(([currency, amount]) => lMoney(amount, currency as typeof hotel.currency, locale)).join(' · ')
                          : '—'}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableCard>
            ) : report.type === 'statistics' ? (
              <TableCard caption={t(REPORT_LABEL[report.type])} className="min-w-[56rem]" attached>
                <thead>
                  <tr className="border-b border-border">
                    <Th>{t('ops.thRoom')}</Th>
                    <Th>{t('reports.reference')}</Th>
                    <Th>{t('reports.breakfast')}</Th>
                    <Th>{t('ops.thCheckIn')}</Th>
                    <Th>{t('ops.thCheckOut')}</Th>
                    <Th>{t('reports.comment')}</Th>
                    <Th className="text-right">{t('reports.stayTotal')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {report.statisticsRows?.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-b-0">
                      <Td className="font-medium whitespace-nowrap">{row.roomNumber ? lRoomNumber(row.roomNumber, locale) : t('booking.notAssigned')}</Td>
                      <Td className="tabular-nums">{row.booking?.reference ?? '—'}</Td>
                      <Td className="tabular-nums">{row.booking?.breakfastGuests || '—'}</Td>
                      <Td className="whitespace-nowrap">{row.booking ? lDateShort(row.booking.checkIn, locale) : '—'}</Td>
                      <Td className="whitespace-nowrap">{row.booking ? lDateShort(row.booking.checkOut, locale) : '—'}</Td>
                      <Td className="min-w-48 max-w-72">
                        <div className="flex flex-col items-start gap-1.5">
                          {row.housekeepingStatus ? <HousekeepingStatusBadge status={row.housekeepingStatus} /> : null}
                          {row.note ? <span className="text-muted-foreground">{row.note}</span> : null}
                          {row.booking?.diningItems?.length ? <span className="text-muted-foreground">{t('reports.dining')}: {row.booking.diningItems.join(', ')}</span> : null}
                          {!row.housekeepingStatus && !row.note && !row.booking?.diningItems?.length ? '—' : null}
                        </div>
                      </Td>
                      <Td className="text-right tabular-nums whitespace-nowrap">{row.booking ? lMoney(row.booking.total, row.booking.currency, locale) : '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableCard>
            ) : (
              <TableCard caption={t(REPORT_LABEL[report.type])} className="min-w-[48rem]" attached>
                <thead>
                  <tr className="border-b border-border">
                    {isPeriodRows ? <Th>{t('reports.reference')}</Th> : null}
                    <Th>{t('ops.thGuest')}</Th>
                    <Th>{t('ops.thRoom')}</Th>
                    <Th>{t('ops.thCheckIn')}</Th>
                    <Th>{t('ops.thCheckOut')}</Th>
                    <Th>{t('ops.thGuests')}</Th>
                    <Th className="text-right">{t('ops.thTotal')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.bookingId} className="border-b border-border last:border-b-0">
                      {isPeriodRows ? <Td className="tabular-nums">{row.reference}</Td> : null}
                      <Td>
                        {row.guestFirstName} {row.guestLastName}
                        <span className="block text-xs text-muted-foreground">{row.guestEmail}</span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        {row.roomTypeName}
                        <span className="block text-xs text-muted-foreground">
                          {row.roomNumber ? lRoomNumber(row.roomNumber, locale) : t('booking.notAssigned')}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap">{lDate(row.checkIn, locale)}</Td>
                      <Td className="whitespace-nowrap">{lDate(row.checkOut, locale)}</Td>
                      <Td className="whitespace-nowrap">{lGuests(row.adults, row.children, locale)}</Td>
                      <Td className="text-right tabular-nums whitespace-nowrap">{lMoney(row.total, row.currency, locale)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableCard>
            )}
          </div>
        )}
      </div>
    </AdminPage>
  );
}
