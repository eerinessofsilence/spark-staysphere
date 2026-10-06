'use client';

import * as React from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { addDays, format, parseISO } from 'date-fns';
import type { Booking } from '@/lib/domain/schemas';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { DATE_FNS_LOCALES, lDateShort } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { CALENDAR_CLASS_NAMES, CALENDAR_COMPONENTS } from '@/components/search/stay-dates-field';
import { Modal } from '@/components/site/modal';
import { Movements } from './movements-list';

const ISO = 'yyyy-MM-dd';
const PRESETS = [7, 30] as const;

type Tab = 'arrival' | 'departure';
type Period = { key: 'preset'; days: (typeof PRESETS)[number] } | { key: 'custom'; from: string; to: string };

/**
 * Arriving and leaving as two tabs sharing one lane, over a period the desk
 * picks: the next week or month at a press, or any two dates from the same
 * range calendar the reports use. The whole confirmed list comes down and
 * is cut here, so switching the period costs nothing.
 */
export function WeekMovements({
  bookings,
  today,
  roomNames,
}: {
  /** Every confirmed booking — the period is applied here, not on the server. */
  bookings: Booking[];
  today: string;
  roomNames: Map<string, string>;
}) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const [tab, setTab] = React.useState<Tab>('arrival');
  const [period, setPeriod] = React.useState<Period>({ key: 'preset', days: 7 });
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

  const from = period.key === 'custom' ? period.from : today;
  const to = period.key === 'custom' ? period.to : format(addDays(parseISO(today), period.days - 1), ISO);

  React.useEffect(() => {
    if (open) setDraft({ from: parseISO(from), to: parseISO(to) });
  }, [open, from, to]);

  const close = React.useCallback(() => setOpen(false), []);
  const draftFrom = draft?.from ? format(draft.from, ISO) : null;
  const draftTo = draft?.to ? format(draft.to, ISO) : draftFrom;

  const arriving = bookings
    .filter((booking) => booking.checkIn >= from && booking.checkIn <= to)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const leaving = bookings
    .filter((booking) => booking.checkOut >= from && booking.checkOut <= to)
    .sort((a, b) => a.checkOut.localeCompare(b.checkOut));
  const shown = tab === 'arrival' ? arriving : leaving;
  const dates = shown.map((booking) => (tab === 'arrival' ? booking.checkIn : booking.checkOut));

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('reports.period')}>
        {PRESETS.map((days) => {
          const active = period.key === 'preset' && period.days === days;
          return (
            <button
              key={days}
              type="button"
              aria-pressed={active}
              onClick={() => setPeriod({ key: 'preset', days })}
              className={pill(active ? 'primary' : 'secondary', 'min-h-9 px-3.5 text-xs')}
            >
              {t('dashboard.nextDays', { n: days })}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={pill(period.key === 'custom' ? 'primary' : 'secondary', 'min-h-9 px-3.5 text-xs')}
        >
          {t('reports.customDates')}
        </button>
        <span className="ml-auto text-xs whitespace-nowrap text-muted-foreground">
          {lDateShort(from, locale)}{from === to ? '' : ` – ${lDateShort(to, locale)}`}
        </span>
      </div>

      {arriving.length === 0 && leaving.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          {t('dashboard.noMovements')}
        </p>
      ) : (
        <>
          <div role="tablist" aria-label={t('dashboard.movements')} className="mt-4 mb-3 inline-flex gap-1 rounded-full bg-stone/60 p-1">
            {(
              [
                ['arrival', t('dashboard.arriving'), arriving.length],
                ['departure', t('dashboard.leaving'), leaving.length],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-sm font-medium tabular-nums transition-colors',
                  tab === key ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label} · {count}
              </button>
            ))}
          </div>
          <Movements
            kind={tab}
            title={tab === 'arrival' ? t('dashboard.arriving') : t('dashboard.leaving')}
            hideHeader
            bookings={shown}
            dates={dates}
            roomNames={roomNames}
            t={t}
            locale={locale}
            limit={8}
          />
        </>
      )}

      <Modal open={open} onClose={close} title={t('reports.customDates')} className="sm:max-w-[44rem]">
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
          locale={DATE_FNS_LOCALES[locale]}
        />
        <div className="mt-4 border-t border-border pt-4">
          <p role="status" className="text-center text-sm text-muted-foreground">
            {draftFrom && draftTo && draftTo !== draftFrom
              ? `${lDateShort(draftFrom, locale)} – ${lDateShort(draftTo, locale)}`
              : draftFrom
                ? lDateShort(draftFrom, locale)
                : t('reports.customDates')}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={close} className={pill('ghost', 'min-h-10 px-4')}>
              {t('frontDesk.cancel')}
            </button>
            <button
              type="button"
              disabled={!draftFrom}
              onClick={() => {
                if (!draftFrom) return;
                setPeriod({ key: 'custom', from: draftFrom, to: draftTo ?? draftFrom });
                close();
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
