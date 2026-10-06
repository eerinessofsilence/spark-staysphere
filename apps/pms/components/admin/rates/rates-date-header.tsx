import { format, parseISO } from 'date-fns';
import type { Locale as DateFnsLocale } from 'date-fns';
import type { AdminT } from '@/lib/i18n/admin/translate';
import { cn } from '@/lib/utils';

/** Date columns shared by both rate screens; StickyRatesGrid pins this row above the body. */
export function RatesDateHeader({
  dates,
  columns,
  dateFnsLocale,
  t,
  label,
  today,
}: {
  dates: string[];
  columns: string;
  dateFnsLocale: DateFnsLocale;
  t: AdminT;
  label?: string;
  today: string;
}) {
  return (
    <div className="grid border-b border-border" style={{ gridTemplateColumns: columns }}>
      <div className="sticky left-0 z-20 flex items-end bg-card px-4 py-3 text-xs text-muted-foreground">
        {label ?? t('rates.roomType')}
      </div>
      {dates.map((date) => (
        <div key={date} data-rate-today={date === today ? 'true' : undefined} aria-current={date === today ? 'date' : undefined} className={cn('flex flex-col items-center justify-end border-l border-border py-2 text-xs', date === today && 'bg-accent/10')}>
          <span className="text-muted-foreground">{format(parseISO(date), 'EEE', { locale: dateFnsLocale })}</span>
          <span className={cn('mt-0.5 text-sm font-medium tabular-nums', date === today && 'rounded-full bg-primary px-2 text-primary-foreground')}>{format(parseISO(date), 'd')}</span>
          <span className="text-[11px] text-muted-foreground">{format(parseISO(date), 'MMM', { locale: dateFnsLocale })}</span>
        </div>
      ))}
    </div>
  );
}
