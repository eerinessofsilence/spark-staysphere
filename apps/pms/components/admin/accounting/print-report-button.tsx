'use client';

import { PrinterIcon } from '@heroicons/react/24/outline';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';

/**
 * Prints whatever the page marked `id="report-printable"` — the same print
 * rule `invoice-modal.tsx` uses, aimed at a report instead of a guest's own
 * invoice. Disabled when the report has no rows: a page with only a heading
 * on it is not worth the paper, same as the PDF button beside it.
 */
export function PrintReportButton({ disabled = false }: { disabled?: boolean }) {
  const t = useAdminT();
  return (
    <button
      type="button"
      onClick={() => window.print()}
      disabled={disabled}
      title={disabled ? t('reports.noResults') : undefined}
      className={pill('secondary', 'disabled:opacity-50')}
    >
      <PrinterIcon className="size-4" aria-hidden="true" />
      {t('reports.print')}
    </button>
  );
}
