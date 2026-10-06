import Link from 'next/link';
import type { ReportPeriod } from '@/lib/application/report-period';
import type { ReportPeriodView } from '@/lib/domain/ports';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { adminT } from '@/lib/i18n/admin/translate';
import type { AdminLocale } from '@/lib/i18n/admin/locale';
import { lDateShort } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { ReportPeriodCustomFilter } from './report-period-custom-filter';
import { SavePeriodReportButton } from './save-period-report-button';

const presets = [
  { key: 'yesterday', label: 'reports.yesterday' },
  { key: 'last_week', label: 'reports.lastWeek' },
  { key: 'last_month', label: 'reports.lastMonth' },
] as const satisfies readonly { key: ReportPeriod['key']; label: AdminTranslationKey }[];

export function ReportPeriodFilter({
  view,
  period,
  locale,
}: {
  view: ReportPeriodView;
  period: ReportPeriod;
  locale: AdminLocale;
}) {
  const t = adminT(locale);
  return (
    <div role="group" aria-labelledby="report-period-heading">
      <h3 id="report-period-heading" className="text-sm font-medium text-muted-foreground">{t('reports.period')}</h3>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {presets.map((preset) => (
          <Link
            key={preset.key}
            href={`/admin/accounting/reports?view=${view}&period=${preset.key}`}
            aria-current={period.key === preset.key ? 'true' : undefined}
            className={pill(period.key === preset.key ? 'primary' : 'secondary', 'min-h-10 px-4 text-sm')}
          >
            {t(preset.label)}
          </Link>
        ))}
        <ReportPeriodCustomFilter view={view} period={period} />
        {!period.invalid ? <SavePeriodReportButton view={view} from={period.from} to={period.to} /> : null}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {lDateShort(period.from, locale)}{period.from === period.to ? '' : ` – ${lDateShort(period.to, locale)}`}
      </p>
      {period.invalid ? <p role="alert" className="mt-2 text-sm text-danger">{t('reports.invalidPeriod')}</p> : null}
    </div>
  );
}
