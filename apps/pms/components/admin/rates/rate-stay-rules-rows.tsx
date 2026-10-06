import Link from 'next/link';
import type { RatePlan } from '@/lib/domain/schemas';
import type { AdminT } from '@/lib/i18n/admin/translate';
import type { ContentFormState } from '@/app/admin/content/_lib/form-state';
import { RateCloseoutCell } from './rate-closeout-cell';
import { cn } from '@/lib/utils';

/** HF-style rows, backed by the same rules used for the actual guest quote. */
export function RateStayRulesRows({ rate, dates, columns, href, action, t, today }: {
  rate: RatePlan & { version: number };
  dates: string[];
  columns: string;
  href: string;
  action: (date: string, state: ContentFormState, formData: FormData) => Promise<ContentFormState>;
  t: AdminT;
  today: string;
}) {
  const rows = [
    { label: t('rates.minimumStay'), value: rate.minimumStay },
    { label: t('rates.maximumStay'), value: rate.maximumStay },
    { label: t('rates.minimumStayOnArrival'), value: rate.minimumStayOnArrival },
  ];

  return (
    <>
      {rows.map(({ label, value }) => (
        <div key={label} className="relative grid border-b border-border text-xs" style={{ gridTemplateColumns: columns }}>
          <div className="sticky left-0 z-20 min-w-0 bg-card px-4 py-2">
            <Link href={`${href}#stay-rules-${rate.id}`} className="text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              {label}
            </Link>
          </div>
          {dates.map((date) => (
            <span key={date} data-rate-today={date === today ? 'true' : undefined} className={cn('border-l border-border py-2 text-center tabular-nums text-muted-foreground', date === today && 'bg-accent/10')} aria-label={`${rate.name}, ${label}, ${date}: ${value ?? t('rates.noLimit')}`}>
              {value ?? t('rates.noLimit')}
            </span>
          ))}
        </div>
      ))}
      <div className="relative grid border-b border-border text-xs" style={{ gridTemplateColumns: columns }}>
        <div className="sticky left-0 z-20 flex items-center bg-card px-4 py-2 text-muted-foreground">{t('rates.closeOut')}</div>
        {dates.map((date) => (
          <RateCloseoutCell
            key={date}
            action={action.bind(null, date)}
            date={date}
            rateName={rate.name}
            closed={rate.closedDates?.includes(date) ?? false}
            version={rate.version}
            isToday={date === today}
          />
        ))}
      </div>
    </>
  );
}
