import type { Metadata } from 'next';
import { ArrowCounterClockwise, Clock, Money, Receipt } from '@phosphor-icons/react/dist/ssr';
import { buildLedger } from '@/lib/application/accounting';
import { catalogService, hotelRepository } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT } from '@/lib/i18n/admin/translate';
import { lMoney } from '@/lib/i18n/format';
import { pluralForm } from '@/lib/i18n/plural';
import { methodLabel } from '@/components/admin/operations/payment-state';
import { Meter, Metric } from '@/components/admin/operations/metric-card';
import { paginate, Pagination, tablePager } from '@/components/admin/operations/pagination';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AccountingTabs } from '@/components/admin/accounting/accounting-tabs';
import { AnimatedMoney } from '@/components/admin/operations/animated-money';
import { PaymentMethodIcon } from '@/components/admin/accounting/payment-method-icon';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('reports.statistics')) };
}

export default async function AccountingStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const sp = await searchParams;
  const methodPager = tablePager(sp, '/admin/accounting/statistics', 'method');
  const [hotel, allBookings] = await Promise.all([
    catalogService.getHotel(await getSelectedHotelSlug()),
    hotelRepository.listBookings(),
  ]);
  const entries = await Promise.all(
    allBookings.filter((booking) => booking.hotelId === hotel.id)
      .map(async (booking) => ({ booking, payments: await hotelRepository.listPaymentAttempts(booking.id) })),
  );
  const ledger = buildLedger(entries);
  const { pageItems, page, totalPages } = paginate(ledger.byMethod, methodPager.page, methodPager.pageSize);
  const money = (value: number) => lMoney(value, hotel.currency, locale);
  const unpaid = ledger.counts.awaiting + ledger.counts.declined;
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
      <AccountingTabs current="statistics" />

      <dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric
          label={t('accounting.collected')}
          icon={<Money weight="fill" />}
          value={<AnimatedMoney amount={ledger.collected} currency={hotel.currency} locale={locale} />}
          detail={counted(ledger.counts.collected, 'accounting.authorizedOne', 'accounting.authorizedFew', 'accounting.authorizedMany')}
          chart={<Meter share={ledger.settledShare} />}
        />
        <Metric
          label={t('accounting.awaitingPayment')}
          icon={<Clock weight="fill" />}
          value={<AnimatedMoney amount={ledger.awaiting} currency={hotel.currency} locale={locale} />}
          detail={ledger.rows.length === 0
            ? t('accounting.noStaysYet')
            : unpaid === 0
              ? t('accounting.everyStayPaid')
              : counted(unpaid, 'accounting.unpaidOne', 'accounting.unpaidFew', 'accounting.unpaidMany')}
        />
        <Metric
          label={t('accounting.owedBack')}
          icon={<ArrowCounterClockwise weight="fill" />}
          value={<AnimatedMoney amount={ledger.owedBack} currency={hotel.currency} locale={locale} />}
          detail={ledger.counts.owed_back === 0
            ? t('accounting.noPaidCancelled')
            : counted(ledger.counts.owed_back, 'accounting.owedOne', 'accounting.owedFew', 'accounting.owedMany')}
        />
        <Metric
          label={t('accounting.bookedValue')}
          icon={<Receipt weight="fill" />}
          value={<AnimatedMoney amount={ledger.bookedValue} currency={hotel.currency} locale={locale} />}
          detail={t('accounting.shareCollected', { percent: Math.round(ledger.settledShare * 100) })}
        />
      </dl>

      <section aria-labelledby="methods-heading" className="mt-12">
        <h2 id="methods-heading" className="text-display text-2xl sm:text-3xl">{t('accounting.byMethod')}</h2>
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
              {pageItems.map((row) => (
                <tr key={row.method ?? 'none'} className="border-b border-border last:border-b-0">
                  <Td className="font-medium whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <PaymentMethodIcon method={row.method} className="text-muted-foreground" />
                      {row.method ? methodLabel(row.method, locale) : t('accounting.noPaymentRecorded')}
                    </span>
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
            page={page}
            totalPages={totalPages}
            total={ledger.byMethod.length}
            pageSize={methodPager.pageSize}
            hrefFor={methodPager.hrefFor}
            pageSizeHrefFor={methodPager.pageSizeHrefFor}
          />
        </div>
      </section>
    </AdminPage>
  );
}
