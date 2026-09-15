'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DayPicker, type DateRange } from 'react-day-picker';
import { CalendarIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { format, parseISO } from 'date-fns';
import { formatDateShort } from '@/lib/formatting';
import { iconButton, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { CALENDAR_CLASS_NAMES, CALENDAR_COMPONENTS } from '@/components/search/stay-dates-field';
import { Modal } from '@/components/site/modal';

const ISO = 'yyyy-MM-dd';

/**
 * The applied range as short as it can be read: "7–13 Sep" inside one month, "28 Sep – 2 Oct" across
 * two, years only when they differ. The long form, weekdays and all, is the button's accessible name.
 */
function rangeLabel(from: string, to: string | null): string {
  const start = parseISO(from);
  const end = parseISO(to ?? from);
  if (!to || to === from) return format(start, 'd MMM');
  if (format(start, 'MMM yyyy') === format(end, 'MMM yyyy')) return `${format(start, 'd')}–${format(end, 'd MMM')}`;
  if (format(start, 'yyyy') === format(end, 'yyyy')) return `${format(start, 'd MMM')} – ${format(end, 'd MMM')}`;
  return `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`;
}

/**
 * The reservations list by stay dates: pick a first and a last day and it
 * keeps every booking with a night between them — an arrival, a departure, or
 * a stay running straight through. The same calendar the guest books with,
 * minus what only a guest needs (no past days greyed out, no nights counted).
 * The range lives in the URL beside `q` and `status`, so it survives a reload
 * and a shared link.
 */
export function BookingDatesFilter({ from, to }: { from: string | null; to: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>(undefined);
  const [months, setMonths] = React.useState(1);

  React.useEffect(() => {
    const query = window.matchMedia('(min-width: 640px)');
    const apply = () => setMonths(query.matches ? 2 : 1);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  // Each opening starts from what is applied, not from an abandoned draft.
  React.useEffect(() => {
    if (open) setDraft(from ? { from: parseISO(from), to: parseISO(to ?? from) } : undefined);
  }, [open, from, to]);

  const close = React.useCallback(() => setOpen(false), []);

  function navigate(range: { from: string; to: string } | null) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (range) {
      params.set('from', range.from);
      params.set('to', range.to);
    } else {
      params.delete('from');
      params.delete('to');
    }
    const search = params.toString();
    router.push(search ? `${pathname}?${search}` : pathname);
  }

  const applied = from ? rangeLabel(from, to) : null;
  const appliedInFull = from
    ? to && to !== from
      ? `${formatDateShort(from)} – ${formatDateShort(to)}`
      : formatDateShort(from)
    : null;
  const draftFrom = draft?.from ? format(draft.from, ISO) : null;
  const draftTo = draft?.to ? format(draft.to, ISO) : draftFrom;

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={appliedInFull ? `Stay dates: ${appliedInFull}. Change them` : 'Filter by stay dates'}
          className={cn(
            'inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors',
            applied
              ? 'bg-primary text-primary-foreground'
              : 'border border-border bg-card text-foreground hover:bg-stone',
          )}
        >
          <CalendarIcon className="size-4 shrink-0" aria-hidden="true" />
          {applied ?? 'Any dates'}
        </button>
        {applied ? (
          <button
            type="button"
            onClick={() => navigate(null)}
            aria-label="Clear stay dates"
            className={iconButton('light')}
          >
            <XMarkIcon className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <Modal open={open} onClose={close} title="Filter by stay dates" className="sm:max-w-[44rem]">
        <DayPicker
          mode="range"
          selected={draft}
          onSelect={setDraft}
          numberOfMonths={months}
          showOutsideDays={false}
          weekStartsOn={1}
          fixedWeeks
          defaultMonth={draft?.from ?? (from ? parseISO(from) : new Date())}
          classNames={CALENDAR_CLASS_NAMES}
          components={CALENDAR_COMPONENTS}
        />

        <div className="mt-4 border-t border-border pt-4">
          <p role="status" className="text-center text-sm text-muted-foreground">
            {draftFrom && draftTo && draftTo !== draftFrom
              ? `Stays with a night between ${formatDateShort(draftFrom)} and ${formatDateShort(draftTo)}.`
              : draftFrom
                ? `Stays with a night on ${formatDateShort(draftFrom)}. Pick a second day for a range.`
                : 'Pick the first day, then the last.'}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(undefined);
                if (from) {
                  close();
                  navigate(null);
                }
              }}
              className={pill('ghost', 'min-h-10 px-4')}
            >
              Clear dates
            </button>
            <button
              type="button"
              disabled={!draftFrom}
              onClick={() => {
                if (!draftFrom) return;
                close();
                navigate({ from: draftFrom, to: draftTo ?? draftFrom });
              }}
              className={pill('primary', 'min-h-10 px-5')}
            >
              Show stays
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
