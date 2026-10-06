'use client';

import * as React from 'react';
import { ArchiveBoxArrowDownIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { generateReportAction } from '@/app/admin/accounting/reports/generated/actions';
import type { ReportType } from '@/lib/domain/ports';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';
import { toast } from '@/components/admin/shell/toast';

/**
 * Freezes what the "Online" tab is showing right now into a new row in the
 * "Generated" tab's grid — the one place a report gets saved, so that tab
 * stays a plain history rather than carrying its own filter form.
 */
export function SaveReportButton({ type, date }: { type: ReportType; date: string }) {
  const t = useAdminT();
  const [pending, startTransition] = React.useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await generateReportAction(type, date);
          if (result.ok) toast.success(result.message);
          else toast.error(result.message);
        })
      }
      className={pill('secondary', 'disabled:opacity-50')}
    >
      {pending ? (
        <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <ArchiveBoxArrowDownIcon className="size-4" aria-hidden="true" />
      )}
      {t('reports.saveToGenerated')}
    </button>
  );
}
