'use client';

import * as React from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { toast } from '@/components/admin/shell/toast';
import { buildReportPdf, saveBlob } from './report-pdf-client';
import type { ReportPdfCopy, ReportPdfRow } from './report-pdf-document';

/** Real, downloadable PDF of the report on screen — see `report-pdf-client.ts`. Disabled when there is nothing to put in it. */
export function DownloadReportPdfButton({
  hotelName,
  copy,
  rows,
  filename,
}: {
  hotelName: string;
  copy: ReportPdfCopy;
  rows: ReportPdfRow[];
  filename: string;
}) {
  const t = useAdminT();
  const [creating, setCreating] = React.useState(false);
  const empty = rows.length === 0;

  async function download() {
    if (creating || empty) return;
    setCreating(true);
    try {
      saveBlob(await buildReportPdf(hotelName, copy, rows), filename);
    } catch (error) {
      console.error('Could not create the report PDF:', error);
      toast.error(t('reports.pdfFailed'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={creating || empty}
      title={empty ? t('reports.noResults') : undefined}
      className={pill('secondary', 'disabled:opacity-50')}
    >
      <ArrowDownTrayIcon className={cn('size-4', creating && 'animate-bounce')} aria-hidden="true" />
      {creating ? t('reports.creatingPdf') : t('reports.downloadPdf')}
    </button>
  );
}
