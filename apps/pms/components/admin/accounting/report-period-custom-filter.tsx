'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { DayPicker, type DateRange } from 'react-day-picker';
import { format, parseISO } from 'date-fns';
import type { ReportPeriod } from '@/lib/application/report-period';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { DATE_FNS_LOCALES, lDateShort } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { CALENDAR_CLASS_NAMES, CALENDAR_COMPONENTS } from '@/components/search/stay-dates-field';
import { Modal } from '@/components/site/modal';

const ISO = 'yyyy-MM-dd';

/**
 * The period filter's "Custom dates" pill: the same range calendar as the
 * reservations and front-desk filters (`BookingDatesFilter`,
 * `FrontDeskDateFilter`), replacing two `input[type=date]` fields that
 * rendered as a different control in every browser.
 */
export function ReportPeriodCustomFilter({ view, period }: { view: string; period: ReportPeriod }) {
  const router = useRouter();
  const t = useAdminT();
  const locale = useAdminLocale();
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
    if (open) setDraft({ from: parseISO(period.from), to: parseISO(period.to) });
  }, [open, period.from, period.to]);

  const close = React.useCallback(() => setOpen(false), []);

  const draftFrom = draft?.from ? format(draft.from, ISO) : null;
  const draftTo = draft?.to ? format(draft.to, ISO) : draftFrom;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={pill(period.key === 'custom' ? 'primary' : 'secondary', 'min-h-10 px-4 text-sm')}
      >
        {t('reports.customDates')}
      </button>

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
                close();
                const query = new URLSearchParams({ view, period: 'custom', from: draftFrom, to: draftTo ?? draftFrom });
                router.push(`/admin/accounting/reports?${query.toString()}`);
              }}
              className={pill('primary', 'min-h-10 px-5')}
            >
              {t('reports.showReport')}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
