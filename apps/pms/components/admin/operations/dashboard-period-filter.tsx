'use client';

import * as React from 'react';
import Link from 'next/link';
import { AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { DayPicker, type DateRange } from 'react-day-picker';
import { format, parseISO } from 'date-fns';
import type { DashboardPeriod, DashboardPeriodKey } from '@/lib/application/dashboard-period';
import { addIsoDays } from '@/lib/domain/dates';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { DATE_FNS_LOCALES, lDateShort } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { CALENDAR_CLASS_NAMES, CALENDAR_COMPONENTS } from '@/components/search/stay-dates-field';
import { Modal } from '@/components/site/modal';

const ISO = 'yyyy-MM-dd';
const PRESETS = [
  ['today', 1],
  ['next_7', 7],
  ['next_30', 30],
] as const satisfies readonly [Exclude<DashboardPeriodKey, 'custom'>, number][];

/** One bookmarkable period shared by the dashboard's four summary cards. */
export function DashboardPeriodFilter({ period, today }: { period: DashboardPeriod; today: string }) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const [ready, setReady] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>(undefined);
  const [months, setMonths] = React.useState(1);

  React.useEffect(() => setReady(true), []);

  React.useEffect(() => {
    const query = window.matchMedia('(min-width: 640px)');
    const apply = () => setMonths(query.matches ? 2 : 1);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  React.useEffect(() => {
    if (open) setDraft({ from: parseISO(period.from), to: parseISO(period.to) });
  }, [open, period.from, period.to]);

  const close = React.useCallback(() => setOpen(false), []);
  const draftFrom = draft?.from ? format(draft.from, ISO) : null;
  const draftTo = draft?.to ? format(draft.to, ISO) : draftFrom;
  const periodLabel = `${lDateShort(period.from, locale)}${period.from === period.to ? '' : ` – ${lDateShort(period.to, locale)}`}`;

  return (
    <section aria-label={t('dashboard.summaryPeriod')} className="mt-6">
      <div className="flex min-w-0 items-center gap-3 lg:hidden">
        <button
          type="button"
          disabled={!ready}
          onClick={() => setMobileOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={mobileOpen}
          className={pill('secondary', 'min-h-11 shrink-0 gap-2 px-4 text-sm shadow-soft')}
        >
          <AdjustmentsHorizontalIcon className="size-4" aria-hidden="true" />
          {t('ops.filters')}
        </button>
        <p className="min-w-0 text-sm text-muted-foreground">{periodLabel}</p>
      </div>

      <div className="hidden rounded-[18px] bg-card p-5 shadow-soft lg:block">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto min-w-48">
            <h2 className="font-medium">{t('dashboard.summaryPeriod')}</h2>
            <p className="mt-0.5 text-base text-muted-foreground">{periodLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('reports.period')}>
            {PRESETS.map(([key, days]) => (
              <Link
                key={key}
                href={`/admin?period=${key}`}
                aria-current={period.key === key ? 'page' : undefined}
                className={pill(period.key === key ? 'primary' : 'secondary', 'min-h-10 px-4 text-sm')}
              >
                {key === 'today' ? t('dashboard.today') : t('dashboard.nextDays', { n: days })}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={open}
              className={pill(period.key === 'custom' ? 'primary' : 'secondary', 'min-h-10 px-4 text-sm')}
            >
              {t('reports.customDates')}
            </button>
          </div>
        </div>
      </div>

      <Modal open={mobileOpen} onClose={() => setMobileOpen(false)} title={t('dashboard.summaryPeriod')}>
        <p className="mb-4 text-base text-muted-foreground">{periodLabel}</p>
        <div role="group" aria-label={t('reports.period')} className="grid grid-cols-2 gap-2">
          {PRESETS.map(([key, days]) => (
            <Link
              key={key}
              href={`/admin?period=${key}`}
              onClick={() => setMobileOpen(false)}
              aria-current={period.key === key ? 'page' : undefined}
              className={pill(period.key === key ? 'primary' : 'secondary', 'min-h-11 w-full px-3 text-sm')}
            >
              {key === 'today' ? t('dashboard.today') : t('dashboard.nextDays', { n: days })}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => { setMobileOpen(false); setOpen(true); }}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={pill(period.key === 'custom' ? 'primary' : 'secondary', 'min-h-11 w-full px-3 text-sm')}
          >
            {t('reports.customDates')}
          </button>
        </div>
      </Modal>

      <Modal open={open} onClose={close} title={t('reports.customDates')} className="sm:max-w-[44rem]">
        <DayPicker
          mode="range"
          selected={draft}
          onSelect={setDraft}
          numberOfMonths={months}
          showOutsideDays={false}
          weekStartsOn={1}
          fixedWeeks
          defaultMonth={draft?.from ?? parseISO(period.from)}
          startMonth={parseISO(today)}
          endMonth={parseISO(addIsoDays(today, 89))}
          disabled={{ before: parseISO(today), after: parseISO(addIsoDays(today, 89)) }}
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
            {draftFrom ? (
              <Link
                href={`/admin?${new URLSearchParams({ period: 'custom', from: draftFrom, to: draftTo ?? draftFrom }).toString()}`}
                onClick={close}
                className={pill('primary', 'min-h-10 px-5')}
              >
                {t('ops.show')}
              </Link>
            ) : (
              <button type="button" disabled className={pill('primary', 'min-h-10 px-5')}>
                {t('ops.show')}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </section>
  );
}
