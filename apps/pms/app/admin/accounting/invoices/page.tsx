import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowCounterClockwise, CheckCircle, Clock, MinusCircle, Receipt, XCircle } from '@phosphor-icons/react/dist/ssr';
import { buildInvoiceDetails, buildInvoiceRegister, invoiceBreakdown } from '@/lib/application/accounting-invoices';
import { filterInvoiceRows, parseInvoiceFilters, resetInvoiceFiltersHref } from '@/lib/application/invoice-filters';
import type { LedgerState } from '@/lib/application/accounting';
import { bookingService, catalogService, hotelRepository, ordersService } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { nightsBetween } from '@/lib/domain/pricing';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lDateShort, lMoney, lStayRoomPriceLabel } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { AccountingTabs } from '@/components/admin/accounting/accounting-tabs';
import { AccountingInvoicePreview } from '@/components/admin/accounting/invoice-preview';
import { CreateInvoiceButton } from '@/components/admin/accounting/create-invoice-button';
import { InvoiceRowActions } from '@/components/admin/accounting/invoice-row-actions';
import { InvoiceFiltersBar } from '@/components/admin/accounting/invoice-filters';
import type { InvoiceData } from '@/components/booking/invoice-modal';
import { methodLabel } from '@/components/admin/operations/payment-state';
import { paginate, Pagination, tablePager } from '@/components/admin/operations/pagination';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, `${t('booking.invoices')} — ${t('nav.accounting')}`) };
}

const states: Record<LedgerState, { key: AdminTranslationKey; tone: string; icon: typeof CheckCircle }> = {
  collected: { key: 'accounting.collected', tone: 'text-success', icon: CheckCircle },
  awaiting: { key: 'accounting.awaitingPayment', tone: 'text-warning', icon: Clock },
  declined: { key: 'accounting.declined', tone: 'text-danger', icon: XCircle },
  owed_back: { key: 'accounting.owedBack', tone: 'text-danger', icon: ArrowCounterClockwise },
  void: { key: 'accounting.void', tone: 'text-muted-foreground', icon: MinusCircle },
};

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const hotel = await catalogService.getHotel(await getSelectedHotelSlug());
  const bookings = (await hotelRepository.listBookings()).filter((booking) => booking.hotelId === hotel.id);
  const entries = await Promise.all(bookings.map(async (booking) => ({ booking, payments: await hotelRepository.listPaymentAttempts(booking.id) })));
  const rows = buildInvoiceRegister(entries, hotel.id);
  const filters = parseInvoiceFilters(sp);
  const filteredRows = filterInvoiceRows(rows, filters);
  const resetHref = resetInvoiceFiltersHref(sp);
  const methods = [...new Set(rows.map((row) => row.method))].sort();
  const rooms = await hotelRepository.listRooms(hotel.id);
  const roomNames = new Map(rooms.map((room) => [room.id, room.name]));
  const { invoice: selectedParam, ...listParams } = sp;
  const pager = tablePager(listParams, '/admin/accounting/invoices');
  const { pageItems, page, totalPages } = paginate(filteredRows, pager.page, pager.pageSize);
  const closeHref = pager.hrefFor(page);
  const invoiceHref = (reference: string) => `${closeHref}${closeHref.includes('?') ? '&' : '?'}invoice=${encodeURIComponent(reference)}`;
  const selectedBooking = typeof selectedParam === 'string'
    ? bookings.find((booking) => booking.hotelId === hotel.id && booking.status !== 'draft' && booking.reference === selectedParam)
    : undefined;
  let invoice: InvoiceData | null = null;
  if (selectedBooking) {
    // Only a non-draft booking already scoped to this hotel can produce a demo preview.
    const confirmation = await bookingService.getConfirmation(selectedBooking.reference);
    const { booking, room, payments } = confirmation;
    const breakdown = invoiceBreakdown(confirmation);
    const nights = nightsBetween(booking.checkIn, booking.checkOut);
    invoice = {
      details: buildInvoiceDetails(booking, room?.name ?? booking.roomTypeId, breakdown, payments, await ordersService.list(booking.hotelId)),
      reference: booking.reference, issuedOn: booking.createdAt.slice(0, 10),
      hotelName: hotel.name, hotelLocation: hotel.location,
      guestName: `${booking.guest.firstName} ${booking.guest.lastName}`, guestEmail: booking.guest.email,
      roomName: room?.name ?? booking.roomTypeId,
      checkIn: booking.checkIn, checkOut: booking.checkOut, nights, currency: booking.currency,
      lines: breakdown ? [
        { label: `${room?.name ?? booking.roomTypeId} — ${lStayRoomPriceLabel(breakdown, locale)}`, amount: breakdown.roomTotal },
        ...breakdown.addOnLines.map((line) => ({ label: line.quantity > 1 ? `${line.name} × ${line.quantity}` : line.name, amount: line.total })),
      ] : [{ label: room?.name ?? booking.roomTypeId, amount: booking.total }],
      taxesAndFees: breakdown?.taxesAndFees ?? 0, total: booking.total,
      methodLabel: payments.at(-1) ? methodLabel(payments.at(-1)!.provider, locale) : null,
      paid: payments.some((attempt) => attempt.status === 'authorized'),
    };
  }

  return (
    <AdminPage>
      <AdminPageHeader title={t('nav.accounting')} actions={<CreateInvoiceButton choices={bookings.filter((booking) => booking.status !== 'draft').map((booking) => ({ reference: booking.reference, guestName: `${booking.guest.firstName} ${booking.guest.lastName}`, amount: booking.total, currency: booking.currency }))} />} />
      <AccountingTabs current="invoices" />
      <section aria-labelledby="invoices-heading" className="mt-8">
        <h2 id="invoices-heading" className="text-display text-2xl sm:text-3xl">{t('booking.invoices')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('accounting.invoicesBody')}</p>
        <InvoiceFiltersBar
          filters={filters}
          methods={methods}
          resetHref={resetHref}
          suggestions={filterInvoiceRows(rows, { ...filters, query: '' }).map(({ booking }) => ({
            reference: booking.reference,
            guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
            email: booking.guest.email,
          }))}
        />
        {filters.invalidDates ? <p role="alert" className="mt-3 text-sm text-danger">{t('accounting.invalidInvoiceDates')}</p> : null}
        {selectedParam && !selectedBooking ? <div role="alert" className="mt-4 rounded-[18px] border border-border bg-card p-4">
          <p className="text-sm">{t('accounting.invoiceUnavailable')}</p>
          <Link href={closeHref} className={pill('secondary', 'mt-3')}>{t('accounting.backToInvoices')}</Link>
        </div> : null}
        {rows.length > 0 && filteredRows.length === 0 ? <div className="mt-5 rounded-[18px] bg-card p-8 text-center shadow-soft">
          <h3 role="status" className="text-lg font-medium">{t('accounting.noMatchingInvoices')}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{t('accounting.noMatchingInvoicesBody')}</p>
          <Link href={resetHref} scroll={false} className={pill('secondary', 'mt-5')}>{t('accounting.resetFilters')}</Link>
        </div> : rows.length === 0 ? <div className="mt-5 rounded-[18px] bg-card p-8 text-center shadow-soft">
          <Receipt weight="fill" className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-medium">{t('accounting.noInvoices')}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{t('accounting.noInvoicesBody')}</p>
          <Link href="/admin/bookings" className={pill('secondary', 'mt-5')}>{t('nav.reservations')}</Link>
        </div> : <div className="mt-5 overflow-hidden rounded-[18px] bg-card shadow-soft">
          <TableCard caption={t('booking.invoices')} className="min-w-[56rem]" attached>
            <thead><tr className="border-b border-border">
              <Th>{t('booking.thInvoice')}</Th><Th>{t('accounting.invoiceDate')}</Th>
              <Th>{t('ops.thGuest')}</Th><Th>{t('ops.thBookingNumber')}</Th><Th>{t('ops.thRoom')}</Th>
              <Th>{t('ops.thStatus')}</Th><Th className="text-right">{t('accounting.thAmount')}</Th><Th className="w-14"><span className="sr-only">{t('reports.thActions')}</span></Th>
            </tr></thead>
            <tbody>{pageItems.map(({ booking, state }) => {
              const meta = states[state];
              return <tr key={booking.id} className="border-b border-border last:border-b-0 hover:bg-stone/50">
                <Td className="whitespace-nowrap"><Link href={invoiceHref(booking.reference)} scroll={false}
                  aria-label={`${t('booking.viewInvoice')} INV-${booking.reference}`} className="inline-flex min-h-11 items-center gap-2 font-medium hover:text-accent-strong">
                  <Receipt weight="fill" className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />INV-{booking.reference}
                </Link></Td>
                <Td className="whitespace-nowrap">{lDateShort(booking.createdAt.slice(0, 10), locale)}</Td>
                <Td><span className="font-medium">{booking.guest.firstName} {booking.guest.lastName}</span>
                  <span className="block text-xs text-muted-foreground">{booking.guest.email}</span></Td>
                <Td><Link href={`/admin/bookings/${booking.reference}`} className="inline-flex min-h-11 items-center font-medium hover:text-accent-strong">{booking.reference}</Link></Td>
                <Td>{roomNames.get(booking.roomTypeId) ?? booking.roomTypeId}</Td>
                <Td><span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap font-medium', meta.tone)}>
                  <meta.icon weight="fill" className="size-4 shrink-0" aria-hidden="true" />{t(meta.key)}
                </span></Td>
                <Td className="text-right whitespace-nowrap tabular-nums">{lMoney(booking.total, booking.currency, locale)}</Td>
                <Td className="text-right"><InvoiceRowActions reference={booking.reference} canCancel={booking.status !== 'cancelled'} /></Td>
              </tr>;
            })}</tbody>
          </TableCard>
          <Pagination attached page={page} totalPages={totalPages} total={filteredRows.length} pageSize={pager.pageSize} hrefFor={pager.hrefFor} pageSizeHrefFor={pager.pageSizeHrefFor} />
        </div>}
      </section>
      {invoice ? <AccountingInvoicePreview key={invoice.reference} invoice={invoice} closeHref={closeHref} /> : null}
    </AdminPage>
  );
}
