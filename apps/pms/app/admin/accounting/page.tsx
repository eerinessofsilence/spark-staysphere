import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowCounterClockwise, CheckCircle, Clock, MinusCircle, Receipt, XCircle } from '@phosphor-icons/react/dist/ssr';
import { buildLedger, type LedgerState } from '@/lib/application/accounting';
import { filterPaymentRows, parsePaymentFilters, resetPaymentFiltersHref } from '@/lib/application/accounting-filters';
import { bookingService, catalogService, guestAppUrl, hotelRepository, ordersService } from '@/lib/application/container';
import { invoiceBreakdown } from '@/lib/application/accounting-invoices';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lDateShort, lMoney } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { AddPaymentButton, type UnpaidBooking } from '@/components/admin/accounting/add-payment-button';
import { RefundButton, type RefundableBooking } from '@/components/admin/accounting/refund-button';
import { PaymentMethodIcon } from '@/components/admin/accounting/payment-method-icon';
import { AccountingTabs } from '@/components/admin/accounting/accounting-tabs';
import { PaymentFiltersBar } from '@/components/admin/accounting/payment-filters';
import { methodLabel } from '@/components/admin/operations/payment-state';
import { paginate, Pagination, tablePager } from '@/components/admin/operations/pagination';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('nav.accounting')) };
}

/** Status is never colour alone: a filled mark and the words, per DESIGN_SYSTEM.md rule 10. */
const states: Record<LedgerState, { key: AdminTranslationKey; tone: string; icon: typeof CheckCircle }> = {
  collected: { key: 'accounting.collected', tone: 'text-success', icon: CheckCircle },
  awaiting: { key: 'accounting.awaitingPayment', tone: 'text-warning', icon: Clock },
  declined: { key: 'accounting.declined', tone: 'text-danger', icon: XCircle },
  owed_back: { key: 'accounting.owedBack', tone: 'text-danger', icon: ArrowCounterClockwise },
  void: { key: 'accounting.void', tone: 'text-muted-foreground', icon: MinusCircle },
};

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const sp = await searchParams;
  const pager = tablePager(sp, '/admin/accounting');
  const filters = parsePaymentFilters(sp);
  const resetHref = resetPaymentFiltersHref(sp);
  const [hotel, allBookings] = await Promise.all([
    catalogService.getHotel(await getSelectedHotelSlug()),
    hotelRepository.listBookings(),
  ]);
  const bookings = allBookings.filter((booking) => booking.hotelId === hotel.id);
  const rooms = await hotelRepository.listRooms(hotel.id);
  const roomNames = new Map(rooms.map((room) => [room.id, room.name]));
  const entries = await Promise.all(
    bookings.map(async (booking) => ({ booking, payments: await hotelRepository.listPaymentAttempts(booking.id) })),
  );
  const ledger = buildLedger(entries);
  const filteredRows = filterPaymentRows(ledger.rows, filters);
  const methods = [...new Set([...ledger.rows.map((row) => row.method ?? 'none'), ...(filters.method ? [filters.method] : [])])].sort();
  const unpaidBookings: UnpaidBooking[] = ledger.rows
    .filter((row) => row.state === 'awaiting' || row.state === 'declined')
    .map((row) => ({
      reference: row.booking.reference,
      guestName: `${row.booking.guest.firstName} ${row.booking.guest.lastName}`,
      roomName: roomNames.get(row.booking.roomTypeId) ?? row.booking.roomTypeId,
      amount: row.amount,
      currency: row.booking.currency,
    }));
  const orders = await ordersService.list(hotel.id);
  const refundableBase = entries.flatMap(({ booking, payments }) => {
    const paid = payments.filter((item) => item.status === 'authorized').reduce((sum, item) => sum + item.amount, 0);
    const refunded = payments.filter((item) => item.status === 'refunded').reduce((sum, item) => sum + item.amount, 0);
    const refundable = Math.round(Math.max(0, paid - refunded) * 100) / 100;
    return refundable > 0 ? [{ booking, refundable }] : [];
  });
  const refundableBookings: RefundableBooking[] = await Promise.all(refundableBase.map(async ({ booking, refundable }) => {
    const confirmation = await bookingService.getConfirmation(booking.reference);
    const breakdown = invoiceBreakdown(confirmation);
    const lines = breakdown ? [
      { id: 'room', label: `${roomNames.get(booking.roomTypeId) ?? t('reports.roomType')} · ${t('accounting.roomAndTaxes')}`, amount: breakdown.roomTotal + breakdown.taxesAndFees, kind: 'room' as const },
      ...breakdown.addOnLines.map((line) => ({ id: `addon:${line.addOnId}`, label: line.name, amount: line.total, kind: 'service' as const })),
    ] : [{ id: 'room', label: roomNames.get(booking.roomTypeId) ?? t('accounting.roomAndTaxes'), amount: booking.total, kind: 'room' as const }];
    const orderLines = orders.filter((order) => order.bookingReference === booking.reference && order.paymentStatus !== 'unpaid' && order.status !== 'cancelled')
      .map((order) => ({ id: `order:${order.id}`, label: `${order.serviceName} · #${order.id}`, amount: order.total, kind: 'order' as const }));
    return { reference: booking.reference, guestName: `${booking.guest.firstName} ${booking.guest.lastName}`, refundable, currency: booking.currency, lines: [...lines, ...orderLines] };
  }));
  const refundableByReference = new Map(refundableBookings.map((booking) => [booking.reference, booking]));
  const { pageItems: pageRows, page: currentPage, totalPages } = paginate(filteredRows, pager.page, pager.pageSize);
  const money = (value: number) => lMoney(value, hotel.currency, locale);

  return (
    <AdminPage>
      <AdminPageHeader title={t('nav.accounting')} actions={<AddPaymentButton bookings={unpaidBookings} />} />
      <AccountingTabs current="payments" />

      <section aria-labelledby="ledger-heading" className="mt-12">
        <h2 id="ledger-heading" className="text-display text-2xl sm:text-3xl">
          {t('accounting.payments')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('accounting.paymentsBody')}</p>
        <PaymentFiltersBar filters={filters} methods={methods} resetHref={resetHref} suggestions={ledger.rows.map(({ booking }) => ({
          value: booking.reference,
          label: `${booking.guest.firstName} ${booking.guest.lastName}`,
          detail: booking.guest.email,
        }))} />
        {filters.invalidDates ? <p role="alert" className="mt-3 text-sm text-danger">{t('accounting.invalidFilterDates')}</p> : null}
        <div className="mt-5">
          {ledger.rows.length === 0 ? (
            <div className="flex flex-col items-center rounded-[18px] bg-card px-6 py-10 text-center shadow-soft">
              <span className="grid size-12 place-items-center rounded-full bg-stone text-muted-foreground">
                <Receipt weight="fill" className="size-5" aria-hidden="true" />
              </span>
              <p className="mt-3 font-medium">{t('accounting.noPaymentsYet')}</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">{t('accounting.noPaymentsBody')}</p>
              {guestAppUrl('/rooms') ? <a href={guestAppUrl('/rooms')!} className={pill('primary', 'mt-4')}>{t('ops.makeDemoBooking')}</a> : null}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-[18px] bg-card px-6 py-10 text-center shadow-soft">
              <p role="status" className="font-medium">{t('accounting.noMatchingPayments')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('accounting.noMatchingPaymentsBody')}</p>
              <Link href={resetHref} scroll={false} className={pill('secondary', 'mt-4')}>{t('accounting.resetFilters')}</Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[18px] bg-card shadow-soft">
            <TableCard caption={t('accounting.ledgerCaption')} className="min-w-[64rem]" attached>
              <thead>
                <tr className="border-b border-border">
                  <Th>{t('ops.thBooked')}</Th>
                  <Th>{t('ops.thBookingNumber')}</Th>
                  <Th>{t('ops.thGuest')}</Th>
                  <Th>{t('accounting.thMethod')}</Th>
                  <Th>{t('accounting.thReceipt')}</Th>
                  <Th>{t('accounting.thOperator')}</Th>
                  <Th>{t('ops.thStatus')}</Th>
                  <Th className="text-right">{t('accounting.thAmount')}</Th>
                  <Th className="w-16 text-right">{t('reports.thActions')}</Th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(({ booking, method, receipt, operator, state, amount }) => {
                  const meta = states[state];
                  return (
                    <tr
                      key={booking.id}
                      className="relative border-b border-border transition-colors last:border-b-0 hover:bg-stone/50"
                    >
                      <Td className="whitespace-nowrap">{lDateShort(booking.createdAt.slice(0, 10), locale)}</Td>
                      <Td className="whitespace-nowrap">
                        <Link
                          href={`/admin/bookings/${booking.reference}`}
                          className="font-medium hover:text-accent-strong before:absolute before:inset-0"
                        >
                          {booking.reference}
                        </Link>
                      </Td>
                      <Td>
                        {booking.guest.firstName} {booking.guest.lastName}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          <PaymentMethodIcon method={method} className="text-muted-foreground" />
                          {method ? methodLabel(method, locale) : '—'}
                        </span>
                      </Td>
                      <Td className="whitespace-nowrap font-mono text-xs">{receipt ?? '—'}</Td>
                      <Td className="whitespace-nowrap">{operator ?? '—'}</Td>
                      <Td>
                        <span
                          className={cn('inline-flex items-center gap-1.5 font-medium whitespace-nowrap', meta.tone)}
                        >
                          <meta.icon weight="fill" className="size-4 shrink-0" aria-hidden="true" />
                          {t(meta.key)}
                        </span>
                      </Td>
                      <Td className="text-right tabular-nums whitespace-nowrap">
                        {state === 'void' ? '—' : money(amount)}
                      </Td>
                      <Td className="text-right">{refundableByReference.get(booking.reference) ? <RefundButton booking={refundableByReference.get(booking.reference)!} /> : '—'}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableCard>
            <Pagination
              attached
              page={currentPage}
              totalPages={totalPages}
              total={filteredRows.length}
              pageSize={pager.pageSize}
              hrefFor={pager.hrefFor}
              pageSizeHrefFor={pager.pageSizeHrefFor}
            />
            </div>
          )}
        </div>
      </section>
    </AdminPage>
  );
}
