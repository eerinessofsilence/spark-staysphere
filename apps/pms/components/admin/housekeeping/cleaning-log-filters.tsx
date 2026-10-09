'use client';

import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { usePreloaderRouter as useRouter } from '@/components/ui/preloader-navigation';
import { DayPicker, type DateRange } from 'react-day-picker';
import { CalendarIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { format, parseISO } from 'date-fns';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { DATE_FNS_LOCALES, lDateShort } from '@/lib/i18n/format';
import { fieldClass, iconButton, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { CALENDAR_CLASS_NAMES, CALENDAR_COMPONENTS } from '@/components/search/stay-dates-field';
import { Modal } from '@/components/site/modal';

const ISO = 'yyyy-MM-dd';

/**
 * The cleaning log's own date range and housekeeper filters — the same
 * two-field shape as `BookingDatesFilter`, kept separate because its
 * copy is about a stay, not a log entry. Both filters and the pager
 * live in the URL, so a long room history is still one link away.
 */
export function CleaningLogFilters({
  members,
  member,
  from,
  to,
}: {
  members: { id: string; name: string }[];
  member: string | null;
  from: string | null;
  to: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useAdminT();
  const locale = useAdminLocale();
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

  React.useEffect(() => {
    if (open) setDraft(from ? { from: parseISO(from), to: parseISO(to ?? from) } : undefined);
  }, [open, from, to]);

  function navigate(next: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.delete('page');
    next(params);
    const search = params.toString();
    router.push(search ? `${pathname}?${search}` : pathname);
  }

  const close = React.useCallback(() => setOpen(false), []);
  const applied = from ? (to && to !== from ? `${lDateShort(from, locale)} – ${lDateShort(to, locale)}` : lDateShort(from, locale)) : null;
  const draftFrom = draft?.from ? format(draft.from, ISO) : null;
  const draftTo = draft?.to ? format(draft.to, ISO) : draftFrom;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            'inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors',
            applied ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-foreground hover:bg-stone',
          )}
        >
          <CalendarIcon className="size-4 shrink-0" aria-hidden="true" />
          {applied ?? t('housekeeping.anyDate')}
        </button>
        {applied ? (
          <button
            type="button"
            onClick={() => navigate((params) => { params.delete('from'); params.delete('to'); })}
            aria-label={t('housekeeping.clearDateFilter')}
            className={iconButton('light')}
          >
            <XMarkIcon className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <label className="sr-only" htmlFor="log-member-filter">
        {t('housekeeping.filterByMember')}
      </label>
      <select
        id="log-member-filter"
        value={member ?? ''}
        onChange={(event) => navigate((params) => (event.target.value ? params.set('member', event.target.value) : params.delete('member')))}
        className={cn(fieldClass, 'min-h-11 w-auto')}
      >
        <option value="">{t('housekeeping.allMembers')}</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>

      <Modal open={open} onClose={close} title={t('housekeeping.filterByDate')} className="sm:max-w-[44rem]">
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
              ? `${lDateShort(draftFrom, locale)} – ${lDateShort(draftTo, locale)}`
              : draftFrom
                ? lDateShort(draftFrom, locale)
                : t('housekeeping.anyDate')}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(undefined);
                if (from) {
                  close();
                  navigate((params) => { params.delete('from'); params.delete('to'); });
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
                navigate((params) => { params.set('from', draftFrom); params.set('to', draftTo ?? draftFrom); });
              }}
              className={pill('primary', 'min-h-10 px-5')}
            >
              {t('ops.show')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
