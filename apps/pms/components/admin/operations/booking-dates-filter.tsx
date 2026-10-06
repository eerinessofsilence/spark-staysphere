'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DayPicker, type DateRange } from 'react-day-picker';
import { CalendarIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { format, parseISO, type Locale as DateFnsLocale } from 'date-fns';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { DATE_FNS_LOCALES, lDateShort } from '@/lib/i18n/format';
import { iconButton, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { CALENDAR_CLASS_NAMES, CALENDAR_COMPONENTS } from '@/components/search/stay-dates-field';
import { Modal } from '@/components/site/modal';

const ISO = 'yyyy-MM-dd';

/**
 * The applied range as short as it can be read: "7–13 Sep" inside one month, "28 Sep – 2 Oct" across
 * two, years only when they differ. The long form, weekdays and all, is the button's accessible name.
 */
function rangeLabel(from: string, to: string | null, locale: DateFnsLocale): string {
  const start = parseISO(from);
  const end = parseISO(to ?? from);
  const day = (date: Date, pattern: string) => format(date, pattern, { locale });
  if (!to || to === from) return day(start, 'd MMM');
  if (day(start, 'MMM yyyy') === day(end, 'MMM yyyy')) return `${day(start, 'd')}–${day(end, 'd MMM')}`;
  if (day(start, 'yyyy') === day(end, 'yyyy')) return `${day(start, 'd MMM')} – ${day(end, 'd MMM')}`;
  return `${day(start, 'd MMM yyyy')} – ${day(end, 'd MMM yyyy')}`;
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
  const locale = useAdminLocale();
  const t = useAdminT();
  const dateFnsLocale = DATE_FNS_LOCALES[locale];
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

  const applied = from ? rangeLabel(from, to, dateFnsLocale) : null;
  const appliedInFull = from
    ? to && to !== from
      ? `${lDateShort(from, locale)} – ${lDateShort(to, locale)}`
      : lDateShort(from, locale)
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
          aria-label={appliedInFull ? t('ops.stayDatesChange', { range: appliedInFull }) : t('ops.filterByStayDates')}
          className={cn(
            'inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors',
            applied
              ? 'bg-primary text-primary-foreground'
              : 'border border-border bg-card text-foreground hover:bg-stone',
          )}
        >
          <CalendarIcon className="size-4 shrink-0" aria-hidden="true" />
          {applied ?? t('ops.anyDates')}
        </button>
        {applied ? (
          <button
            type="button"
            onClick={() => navigate(null)}
            aria-label={t('ops.clearStayDates')}
            className={iconButton('light')}
          >
            <XMarkIcon className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <Modal open={open} onClose={close} title={t('ops.filterByStayDates')} className="sm:max-w-[44rem]">
        <DayPicker
          mode="range"
          selected={draft}
          onSelect={setDraft}
          numberOfMonths={months}
          showOutsideDays={false}
          weekStartsOn={1}
          fixedWeeks
          locale={dateFnsLocale}
          defaultMonth={draft?.from ?? (from ? parseISO(from) : new Date())}
          classNames={CALENDAR_CLASS_NAMES}
          components={CALENDAR_COMPONENTS}
        />

        <div className="mt-4 border-t border-border pt-4">
          <p role="status" className="text-center text-sm text-muted-foreground">
            {draftFrom && draftTo && draftTo !== draftFrom
              ? t('ops.datesBetween', { from: lDateShort(draftFrom, locale), to: lDateShort(draftTo, locale) })
              : draftFrom
                ? t('ops.datesOn', { date: lDateShort(draftFrom, locale) })
                : t('ops.datesPick')}
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
              {t('ops.clearDates')}
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
              {t('ops.showStays')}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
