import Link from 'next/link';
import type { RatePlan } from '@/lib/domain/schemas';
import type { AdminLocale } from '@/lib/i18n/admin/locale';
import type { AdminT } from '@/lib/i18n/admin/translate';
import { lDateShort, lMoney } from '@/lib/i18n/format';

/** The base nightly price is the same on every date until dated rates exist. */
export function RatePlanOverviewRow({
  rate,
  dates,
  columns,
  href,
  locale,
  t,
}: {
  rate: RatePlan;
  dates: string[];
  columns: string;
  href: string;
  locale: AdminLocale;
  t: AdminT;
}) {
  return (
    <div data-rate-plan={rate.id} className="relative grid items-center border-b border-border last:border-b-0" style={{ gridTemplateColumns: columns }}>
      <div className="sticky left-0 z-20 min-w-0 bg-card px-4 py-2.5">
        <Link href={href} className="block truncate font-medium hover:text-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          {rate.name}
        </Link>
      </div>
      {dates.map((date) => (
        <div key={date} data-rate-price className="border-l border-border px-1 py-2.5 text-center tabular-nums">
          <span aria-hidden="true">{rate.nightlyPrice}</span>
          <span className="sr-only">
            {t('rates.basePriceOnDate', { date: lDateShort(date, locale), price: lMoney(rate.nightlyPrice, rate.currency, locale) })}
          </span>
        </div>
      ))}
    </div>
  );
}
