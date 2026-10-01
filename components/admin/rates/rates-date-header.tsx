import { format, parseISO } from 'date-fns';
import type { Locale as DateFnsLocale } from 'date-fns';
import type { AdminT } from '@/lib/i18n/admin/translate';

/** The date-columns head every rates grid shares — sticky-first-column body rows sit under it. */
export function RatesDateHeader({
  dates,
  columns,
  dateFnsLocale,
  t,
  label,
}: {
  dates: string[];
  columns: string;
  dateFnsLocale: DateFnsLocale;
  t: AdminT;
  label?: string;
}) {
  return (
    <div className="grid border-b border-border" style={{ gridTemplateColumns: columns }}>
      <div className="sticky left-0 z-20 flex items-end bg-card px-4 py-3 text-xs text-muted-foreground">
        {label ?? t('rates.roomType')}
      </div>
      {dates.map((date) => (
        <div key={date} className="flex flex-col items-center justify-end border-l border-border py-2 text-xs">
          <span className="text-muted-foreground">{format(parseISO(date), 'EEE', { locale: dateFnsLocale })}</span>
          <span className="mt-0.5 text-sm font-medium tabular-nums">{format(parseISO(date), 'd')}</span>
          <span className="text-[11px] text-muted-foreground">{format(parseISO(date), 'MMM', { locale: dateFnsLocale })}</span>
        </div>
      ))}
    </div>
  );
}
