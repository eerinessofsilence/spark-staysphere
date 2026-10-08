'use client';

import * as React from 'react';
import { Preloader } from '@/components/ui/preloader';
import { ArchiveBoxArrowDownIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { generatePeriodReportAction } from '@/app/admin/accounting/reports/generated/actions';
import type { ReportPeriodView } from '@/lib/domain/ports';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';
import { toast } from '@/components/admin/shell/toast';

/**
 * `SaveReportButton`'s counterpart for the four period views: freezes what
 * "Manager analytics"/"Financial"/"Guest ledger"/"Statistics" is showing
 * right now into a new row in the "Generated" tab's grid.
 */
export function SavePeriodReportButton({ view, from, to }: { view: ReportPeriodView; from: string; to: string }) {
  const t = useAdminT();
  const [pending, startTransition] = React.useTransition();

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await generatePeriodReportAction(view, from, to);
            if (result.ok) toast.success(result.message);
            else toast.error(result.message);
          })
        }
        className={pill('primary', 'min-h-10 px-4 text-sm')}
      >
        {pending ? (
          <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <ArchiveBoxArrowDownIcon className="size-4" aria-hidden="true" />
        )}
        {t('reports.generate')}
      </button>
      <Preloader active={pending} label={t('page.loading')} />
    </>
  );
}
