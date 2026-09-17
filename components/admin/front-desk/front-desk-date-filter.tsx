'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { DayPicker, type DateRange } from 'react-day-picker';
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { addIsoDays } from '@/lib/domain/dates';
import { nightsBetween } from '@/lib/domain/pricing';
import { formatDateShort } from '@/lib/formatting';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { CALENDAR_CLASS_NAMES, CALENDAR_COMPONENTS } from '@/components/search/stay-dates-field';
import { Modal } from '@/components/site/modal';
import { frontDeskHref, MAX_CUSTOM_WINDOW, WINDOW_OPTIONS } from './front-desk-shared';

const ISO = 'yyyy-MM-dd';

/**
 * The fourth segment beside 7/14/30 nights: any start and end day, not only
 * a fixed length from wherever "Today" happens to be. Reuses the guest
 * calendar's own day button and month-grid classes, the way the reservations
 * list's own date filter already does, so the one calendar widget in the
 * product looks the same wherever it turns up in `/admin`.
 */
export function FrontDeskDateFilter({
  from,
  days,
  type,
}: {
  from: string;
  days: number;
  type: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>(undefined);
  const [months, setMonths] = React.useState(1);
  const isCustom = !(WINDOW_OPTIONS as readonly number[]).includes(days);

  React.useEffect(() => {
    const query = window.matchMedia('(min-width: 640px)');
    const apply = () => setMonths(query.matches ? 2 : 1);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  // Opens from what is currently applied, not from wherever the guest calendar
  // last happened to land — a custom range always starts from `from`/`days`,
  // a preset window opens with nothing picked yet.
  React.useEffect(() => {
    if (!open) return;
    setDraft(isCustom ? { from: parseISO(from), to: parseISO(addIsoDays(from, days - 1)) } : undefined);
  }, [open, from, days, isCustom]);

  const close = React.useCallback(() => setOpen(false), []);

  const draftFrom = draft?.from ? format(draft.from, ISO) : null;
  const draftTo = draft?.to ? format(draft.to, ISO) : draftFrom;
  // The board draws one column per calendar day picked, both ends inclusive —
  // a range end is the last night shown, not a checkout the way a stay's is.
  const draftWindowLength = draftFrom && draftTo ? nightsBetween(draftFrom, draftTo) + 1 : 0;
  const tooLong = draftWindowLength > MAX_CUSTOM_WINDOW;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={isCustom ? `Custom range: ${formatDateShort(from)} to ${formatDateShort(addIsoDays(from, days - 1))}. Change it` : 'Pick a custom date range'}
        className={cn(
          'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors sm:min-h-9 sm:px-3',
          isCustom ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-stone',
        )}
      >
        <CalendarIcon className="size-4 shrink-0" aria-hidden="true" />
        {isCustom ? `${formatDateShort(from)} – ${formatDateShort(addIsoDays(from, days - 1))}` : 'Custom'}
      </button>

      <Modal open={open} onClose={close} title="Custom date range" className="sm:max-w-[44rem]">
        <DayPicker
          mode="range"
          selected={draft}
          onSelect={setDraft}
          numberOfMonths={months}
          showOutsideDays={false}
          weekStartsOn={1}
          fixedWeeks
          defaultMonth={draft?.from ?? parseISO(from)}
          classNames={CALENDAR_CLASS_NAMES}
          components={CALENDAR_COMPONENTS}
        />

        <div className="mt-4 border-t border-border pt-4">
          <p role="status" className={cn('text-center text-sm', tooLong ? 'font-medium text-danger' : 'text-muted-foreground')}>
            {!draftFrom
              ? 'Pick the first night, then the last.'
              : tooLong
                ? `That's ${draftWindowLength} nights — the board shows at most ${MAX_CUSTOM_WINDOW} at a time.`
                : draftTo && draftTo !== draftFrom
                  ? `${formatDateShort(draftFrom)} to ${formatDateShort(draftTo)} · ${draftWindowLength} nights`
                  : 'Pick a second day for a range.'}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={close} className={pill('ghost', 'min-h-10 px-4')}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!draftFrom || !draftTo || draftFrom === draftTo || tooLong}
              onClick={() => {
                if (!draftFrom || !draftTo) return;
                close();
                router.push(frontDeskHref({ from: draftFrom, days: nightsBetween(draftFrom, draftTo) + 1, type }));
              }}
              className={pill('primary', 'min-h-10 px-5')}
            >
              Show this range
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
