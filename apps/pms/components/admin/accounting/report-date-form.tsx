'use client';

import * as React from 'react';
import { usePreloaderRouter as useRouter } from '@/components/ui/preloader-navigation';
import { DayPicker } from 'react-day-picker';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { format, parseISO } from 'date-fns';
import type { ReportType } from '@/lib/domain/ports';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { DATE_FNS_LOCALES, lDate } from '@/lib/i18n/format';
import { fieldClass, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { CALENDAR_CLASS_NAMES, CALENDAR_COMPONENTS } from '@/components/search/stay-dates-field';
import { Modal } from '@/components/site/modal';

const ISO = 'yyyy-MM-dd';

/**
 * The "Online" tab's date: the one calendar the product has, in the same
 * modal the reservations and front-desk filters open, picking a single day
 * instead of a range. Replaces an `input[type=date]`, which rendered as a
 * different control in every browser. "Generate" puts type and date in the
 * URL, so the report stays a link like every other admin filter.
 */
export function ReportDateForm({ type, date }: { type: ReportType; date: string }) {
  const router = useRouter();
  const t = useAdminT();
  const locale = useAdminLocale();
  const [open, setOpen] = React.useState(false);
  const [picked, setPicked] = React.useState(date);
  const [draft, setDraft] = React.useState<Date | undefined>(undefined);

  // The URL owns the applied date; re-sync whenever a navigation changes it.
  React.useEffect(() => setPicked(date), [date]);
  // Each opening starts from what is picked, not from an abandoned draft.
  React.useEffect(() => {
    if (open) setDraft(parseISO(picked));
  }, [open, picked]);

  const close = React.useCallback(() => setOpen(false), []);

  function generate() {
    const query = new URLSearchParams({ type, date: picked });
    router.push(`/admin/accounting/reports?${query.toString()}`);
  }

  return (
    <div className="mt-6 flex flex-wrap items-end gap-3">
      <div>
        <span id="report-date-label" className="mb-1.5 block text-sm text-muted-foreground">
          {t('reports.date')}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-labelledby="report-date-label"
          className={cn(fieldClass, 'flex h-11 min-w-56 cursor-pointer items-center justify-between gap-2 text-left', open && 'border-accent')}
        >
          <span className="font-medium">{lDate(picked, locale)}</span>
          <CalendarIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        </button>
      </div>
      <button type="button" onClick={generate} className={pill('primary')}>
        {t('reports.generate')}
      </button>

      <Modal open={open} onClose={close} title={t('reports.pickDate')} className="sm:max-w-[22rem]">
        <DayPicker
          mode="single"
          required
          selected={draft}
          onSelect={setDraft}
          showOutsideDays={false}
          weekStartsOn={1}
          fixedWeeks
          defaultMonth={draft ?? parseISO(picked)}
          classNames={CALENDAR_CLASS_NAMES}
          components={CALENDAR_COMPONENTS}
          locale={DATE_FNS_LOCALES[locale]}
        />

        <div className="mt-4 border-t border-border pt-4">
          <p role="status" className="text-center text-sm text-muted-foreground">
            {draft ? lDate(format(draft, ISO), locale) : t('reports.pickDate')}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={close} className={pill('ghost', 'min-h-10 px-4')}>
              {t('frontDesk.cancel')}
            </button>
            <button
              type="button"
              disabled={!draft}
              onClick={() => {
                if (!draft) return;
                setPicked(format(draft, ISO));
                close();
              }}
              className={pill('primary', 'min-h-10 px-5')}
            >
              {t('reports.useDate')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
