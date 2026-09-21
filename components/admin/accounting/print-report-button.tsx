'use client';

import { PrinterIcon } from '@heroicons/react/24/outline';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';

/** Prints whatever the page marked `id="report-printable"` — the same print rule `invoice-modal.tsx` uses, aimed at a report instead of a guest's own invoice. */
export function PrintReportButton() {
  const t = useAdminT();
  return (
    <button type="button" onClick={() => window.print()} className={pill('secondary')}>
      <PrinterIcon className="size-4" aria-hidden="true" />
      {t('reports.print')}
    </button>
  );
}
