import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { EyeSlash } from '@phosphor-icons/react/dist/ssr';
import type { RoomType } from '@/lib/domain/schemas';
import type { AdminLocale } from '@/lib/i18n/admin/locale';
import { lDateShort } from '@/lib/i18n/format';
import type { AdminT } from '@/lib/i18n/admin/translate';
import { tag } from '@/lib/ui';
import { cn } from '@/lib/utils';

/** One clickable disclosure row with the room name and nightly availability. */
export function RoomQuotaRow({
  room,
  remaining,
  dates,
  columns,
  locale,
  t,
  today,
}: {
  room: RoomType;
  remaining: Map<string, number>;
  dates: string[];
  columns: string;
  locale: AdminLocale;
  t: AdminT;
  today: string;
}) {
  return (
    // `relative`: every date cell's `sr-only` span is `position:
    // absolute` too, and with no positioned ancestor at all it resolves
    // against the initial containing block instead of this row — invisible,
    // but its layout box still inflates `documentElement.scrollWidth` by
    // the row's full unclipped width.
    <summary data-room-quota-row className="relative grid cursor-pointer list-none items-center border-b border-border bg-stone text-sm hover:bg-stone/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden" style={{ gridTemplateColumns: columns }}>
      <div data-room-quota-label className="sticky left-0 z-20 flex min-w-0 items-center gap-2 overflow-hidden bg-stone px-4 py-3">
        <ChevronRightIcon className="size-4 shrink-0 transition-transform group-open/room:rotate-90" aria-hidden="true" />
        <span className="min-w-0 truncate font-medium">{room.name}</span>
        {room.hidden ? (
          <span className={tag('py-0.5')}>
            <EyeSlash weight="fill" className="size-3.5" aria-hidden="true" />
            {t('rates.hidden')}
          </span>
        ) : null}
      </div>
      {dates.map((date) => {
        const left = remaining.get(date);
        const day = lDateShort(date, locale);
        const spoken =
          left === undefined
            ? t('rates.nightNoData', { date: day })
            : left === 0
              ? t('rates.nightFullyBooked', { date: day })
              : t('rates.nightLeft', { date: day, count: left });
        return (
          <div key={date} data-rate-today={date === today ? 'true' : undefined} className={cn('border-l border-border py-1.5 text-center', date === today && 'bg-accent/10')}>
            <span
              className={cn(
                'inline-block min-w-8 rounded-full px-1.5 py-0.5 text-center text-xs font-medium tabular-nums',
                left === 0 ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success',
              )}
            >
              <span aria-hidden="true">{left === undefined ? '—' : left}</span>
              <span className="sr-only">{spoken}</span>
            </span>
          </div>
        );
      })}
    </summary>
  );
}
