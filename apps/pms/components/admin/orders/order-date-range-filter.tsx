'use client';

import * as React from 'react';
import { usePreloaderRouter as useRouter } from '@/components/ui/preloader-navigation';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { DayPicker, type DateRange } from 'react-day-picker';
import { format, parseISO } from 'date-fns';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { DATE_FNS_LOCALES, lDate } from '@/lib/i18n/format';
import { fieldClass, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { CALENDAR_CLASS_NAMES, CALENDAR_COMPONENTS } from '@/components/search/stay-dates-field';
import { Modal } from '@/components/site/modal';

const ISO = 'yyyy-MM-dd';

function compactRangeLabel(from: string, to: string, locale: keyof typeof DATE_FNS_LOCALES) {
  const start = parseISO(from);
  const end = parseISO(to);
  const dateLocale = DATE_FNS_LOCALES[locale];
  const short = (date: Date, pattern: string) => format(date, pattern, { locale: dateLocale });

  if (from === to) return short(start, 'd MMM yyyy');
  if (short(start, 'MMM yyyy') === short(end, 'MMM yyyy')) {
    return `${short(start, 'd')}–${short(end, 'd MMM yyyy')}`;
  }
  if (short(start, 'yyyy') === short(end, 'yyyy')) {
    return `${short(start, 'd MMM')} – ${short(end, 'd MMM yyyy')}`;
  }
  return `${short(start, 'd MMM yyyy')} – ${short(end, 'd MMM yyyy')}`;
}

/** One inclusive due-date range for the orders list. */
export function OrderDateRangeFilter({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const locale = useAdminLocale();
  const t = useAdminT();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [ready, setReady] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>();

  React.useEffect(() => setReady(true), []);

  function navigate(range: { from: string; to: string } | null) {
    // Carry the current search and other filter selections into the date
    // navigation, including changes typed before this dialog was opened.
    const form = triggerRef.current?.closest('form');
    const params = new URLSearchParams();
    if (form) new FormData(form).forEach((value, key) => {
      if (typeof value === 'string' && value) params.set(key, value);
    });
    params.delete('from');
    params.delete('to');
    if (range) {
      params.set('from', range.from);
      params.set('to', range.to);
      params.set('view', 'all');
    }
    const search = params.toString();
    setOpen(false);
    router.push(`/admin/orders${search ? `?${search}` : ''}`);
  }

  const selectedLabel = from && to
    ? compactRangeLabel(from, to, locale)
    : from ? `${lDate(from, locale)} –` : to ? `– ${lDate(to, locale)}` : null;
  const draftFrom = draft?.from ? format(draft.from, ISO) : null;
  const draftTo = draft?.to ? format(draft.to, ISO) : draftFrom;

  return (
    <div className="min-w-0">
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <button
        ref={triggerRef}
        type="button"
        disabled={!ready}
        aria-label={selectedLabel ? `${t('orders.dueRange')}: ${selectedLabel}` : t('orders.dueRange')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setDraft(from ? { from: parseISO(from), to: to ? parseISO(to) : undefined } : undefined);
          setOpen(true);
        }}
        className={cn(fieldClass, 'flex w-full items-center justify-between gap-3 text-left hover:bg-stone')}
      >
        <span className={cn('min-w-0 truncate', !selectedLabel && 'text-muted-foreground')}>
          {selectedLabel ?? t('orders.dueRange')}
        </span>
        <CalendarIcon className="size-4 shrink-0" aria-hidden="true" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('orders.dueRange')} className="sm:max-w-[26rem]">
        <DayPicker
          mode="range"
          selected={draft}
          onSelect={setDraft}
          numberOfMonths={1}
          showOutsideDays={false}
          weekStartsOn={1}
          fixedWeeks
          locale={DATE_FNS_LOCALES[locale]}
          defaultMonth={draft?.from ?? (from ? parseISO(from) : new Date())}
          classNames={CALENDAR_CLASS_NAMES}
          components={CALENDAR_COMPONENTS}
        />
        <div className="mt-4 border-t border-border pt-4">
          <p role="status" className="text-center text-sm text-muted-foreground">
            {draftFrom
              ? `${lDate(draftFrom, locale)}${draftTo && draftTo !== draftFrom ? ` – ${lDate(draftTo, locale)}` : ''}`
              : t('orders.pickDateRange')}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={() => {
              if (from || to) navigate(null);
              else { setDraft(undefined); setOpen(false); }
            }} className={pill('ghost', 'min-h-10 px-4')}>
              {t('ops.clearDates')}
            </button>
            <button
              type="button"
              disabled={!draftFrom}
              onClick={() => {
                if (draftFrom) navigate({ from: draftFrom, to: draftTo ?? draftFrom });
              }}
              className={pill('primary', 'min-h-10 px-5')}
            >
              {t('orders.showOrders')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
