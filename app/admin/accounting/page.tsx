import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowCounterClockwise, CheckCircle, Clock, MinusCircle, Receipt, XCircle } from '@phosphor-icons/react/dist/ssr';
import { buildLedger, type LedgerState } from '@/lib/application/accounting';
import { catalogService, hotelRepository } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lDateShort, lMoney } from '@/lib/i18n/format';
import { pluralForm } from '@/lib/i18n/plural';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Meter, Metric } from '@/components/admin/operations/metric-card';
import { methodLabel } from '@/components/admin/operations/payment-state';
import { SampleBookingsButton } from '@/components/admin/operations/sample-bookings-button';
import { paginate, parsePage, Pagination } from '@/components/admin/operations/pagination';
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
  const pageParam = parsePage(sp.page);
  const methodPageParam = parsePage(sp.methodPage);
  const [hotel, allBookings] = await Promise.all([
    catalogService.getHotel(await getSelectedHotelSlug()),
    hotelRepository.listBookings(),
  ]);
  const bookings = allBookings.filter((booking) => booking.hotelId === hotel.id);
  const entries = await Promise.all(
    bookings.map(async (booking) => ({ booking, payments: await hotelRepository.listPaymentAttempts(booking.id) })),
  );
  const ledger = buildLedger(entries);
  const { pageItems: pageRows, page: currentPage, totalPages } = paginate(ledger.rows, pageParam);
  const { pageItems: pageMethods, page: methodPage, totalPages: methodTotalPages } = paginate(ledger.byMethod, methodPageParam);
  const money = (value: number) => lMoney(value, hotel.currency, locale);
  const unpaid = ledger.counts.awaiting + ledger.counts.declined;
  const pageHref = (overrides: Partial<{ page: number; methodPage: number }>) => {
    const next = { page: currentPage, methodPage, ...overrides };
    const query = new URLSearchParams();
    if (next.page > 1) query.set('page', String(next.page));
    if (next.methodPage > 1) query.set('methodPage', String(next.methodPage));
    const qs = query.toString();
    return `/admin/accounting${qs ? `?${qs}` : ''}`;
  };
  /** "N things" with the right noun form — Russian needs one/few/many, the other two use one/many. */
  const counted = (count: number, one: AdminTranslationKey, few: AdminTranslationKey, many: AdminTranslationKey) =>
    pluralForm(locale, count, {
      one: t(one, { count }),
      few: t(few, { count }),
      many: t(many, { count }),
      other: t(many, { count }),
    });

  return (
    <AdminPage>
      <AdminPageHeader title={t('nav.accounting')} />

      <dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric
          label={t('accounting.collected')}
          value={money(ledger.collected)}
          detail={counted(
            ledger.counts.collected,
            'accounting.authorizedOne',
            'accounting.authorizedFew',
            'accounting.authorizedMany',
          )}
          chart={<Meter share={ledger.settledShare} />}
        />
        <Metric
          label={t('accounting.awaitingPayment')}
          value={money(ledger.awaiting)}
          detail={
            ledger.rows.length === 0
              ? t('accounting.noStaysYet')
              : unpaid === 0
                ? t('accounting.everyStayPaid')
                : counted(unpaid, 'accounting.unpaidOne', 'accounting.unpaidFew', 'accounting.unpaidMany')
          }
        />
        <Metric
          label={t('accounting.owedBack')}
          value={money(ledger.owedBack)}
          detail={
            ledger.counts.owed_back === 0
              ? t('accounting.noPaidCancelled')
              : counted(ledger.counts.owed_back, 'accounting.owedOne', 'accounting.owedFew', 'accounting.owedMany')
          }
        />
        <Metric
          label={t('accounting.bookedValue')}
          value={money(ledger.bookedValue)}
          detail={t('accounting.shareCollected', { percent: Math.round(ledger.settledShare * 100) })}
        />
      </dl>

      <section aria-labelledby="methods-heading" className="mt-12">
        <h2 id="methods-heading" className="text-display text-2xl sm:text-3xl">
          {t('accounting.byMethod')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('accounting.byMethodBody')}</p>
        <div className="mt-5 overflow-hidden rounded-[18px] bg-card shadow-soft">
          <TableCard caption={t('accounting.byMethodCaption')} className="sm:min-w-[36rem]" attached>
            <thead>
              <tr className="border-b border-border">
                <Th>{t('accounting.thMethod')}</Th>
                <Th className="text-right">{t('accounting.thStays')}</Th>
                <Th className="text-right">{t('accounting.collected')}</Th>
                <Th className="text-right">{t('accounting.thAwaiting')}</Th>
              </tr>
            </thead>
            <tbody>
              {ledger.byMethod.length === 0 ? (
                <tr>
                  <Td colSpan={4} className="py-8 text-center text-muted-foreground">
                    {ledger.rows.length === 0 ? t('accounting.noStaysYetDot') : t('accounting.noneStand')}
                  </Td>
                </tr>
              ) : null}
              {pageMethods.map((row) => (
                <tr key={row.method ?? 'none'} className="border-b border-border last:border-b-0">
                  <Td className="font-medium whitespace-nowrap">
                    {row.method ? methodLabel(row.method, locale) : t('accounting.noPaymentRecorded')}
                  </Td>
                  <Td className="text-right tabular-nums">{row.stays}</Td>
                  <Td className="text-right tabular-nums whitespace-nowrap">{money(row.collected)}</Td>
                  <Td className="text-right tabular-nums whitespace-nowrap">{money(row.awaiting)}</Td>
                </tr>
              ))}
            </tbody>
          </TableCard>
          <Pagination
            attached
            page={methodPage}
            totalPages={methodTotalPages}
            total={ledger.byMethod.length}
            hrefFor={(p) => pageHref({ methodPage: p })}
          />
        </div>
      </section>

      <section aria-labelledby="ledger-heading" className="mt-12">
        <h2 id="ledger-heading" className="text-display text-2xl sm:text-3xl">
          {t('accounting.payments')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('accounting.paymentsBody')}</p>
        <div className="mt-5">
          {ledger.rows.length === 0 ? (
            <div className="flex flex-col items-center rounded-[18px] bg-card px-6 py-10 text-center shadow-soft">
              <span className="grid size-12 place-items-center rounded-full bg-stone text-muted-foreground">
                <Receipt weight="fill" className="size-5" aria-hidden="true" />
              </span>
              <p className="mt-3 font-medium">{t('accounting.noPaymentsYet')}</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">{t('accounting.noPaymentsBody')}</p>
              <div className="mt-4 flex flex-wrap items-start justify-center gap-2">
                <Link href="/rooms" className={pill('primary')}>
                  {t('ops.makeDemoBooking')}
                </Link>
                <SampleBookingsButton />
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[18px] bg-card shadow-soft">
            <TableCard caption={t('accounting.ledgerCaption')} className="min-w-[48rem]" attached>
              <thead>
                <tr className="border-b border-border">
                  <Th>{t('ops.thBooked')}</Th>
                  <Th>{t('ops.thBookingNumber')}</Th>
                  <Th>{t('ops.thGuest')}</Th>
                  <Th>{t('accounting.thMethod')}</Th>
                  <Th>{t('ops.thStatus')}</Th>
                  <Th className="text-right">{t('accounting.thAmount')}</Th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(({ booking, method, state, amount }) => {
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
                      <Td className="whitespace-nowrap">{method ? methodLabel(method, locale) : '—'}</Td>
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
                    </tr>
                  );
                })}
              </tbody>
            </TableCard>
            <Pagination
              attached
              page={currentPage}
              totalPages={totalPages}
              total={ledger.rows.length}
              hrefFor={(p) => pageHref({ page: p })}
            />
            </div>
          )}
        </div>
      </section>
    </AdminPage>
  );
}
