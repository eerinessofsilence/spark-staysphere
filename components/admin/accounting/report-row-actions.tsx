'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu } from '@base-ui/react/menu';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  DocumentMagnifyingGlassIcon,
  DocumentTextIcon,
  EllipsisHorizontalIcon,
} from '@heroicons/react/24/outline';
import { useAdminT } from '@/lib/i18n/admin/context';
import { toast } from '@/components/admin/shell/toast';
import { menuItemClass } from '@/components/admin/operations/booking-row-actions';
import { buildReportPdf, saveBlob } from './report-pdf-client';
import type { ReportPdfCopy, ReportPdfRow } from './report-pdf-document';
import { ReportPdfPreview } from './report-pdf-preview';

/**
 * A generated report's actions behind one "⋯", the same shape as a
 * reservation row's (`BookingRowActions`): open the PDF right here in a
 * dialog (`ReportPdfPreview`), download it, or open the report's page. The
 * PDF items sit disabled on an empty report; a file with only a heading in
 * it is not worth a click.
 */
export function ReportRowActions({
  label,
  href,
  hotelName,
  copy,
  rows,
  filename,
}: {
  /** The row's own name — for the trigger's accessible label and the preview's title. */
  label: string;
  href: string;
  hotelName: string;
  copy: ReportPdfCopy;
  rows: ReportPdfRow[];
  filename: string;
}) {
  const t = useAdminT();
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState<Blob | null>(null);
  const closePreview = React.useCallback(() => setPreview(null), []);
  const empty = rows.length === 0;

  // The dialog's frame needs the browser's own inline PDF viewer, which
  // phones and tablets (mobile Chrome, Android, older iPads) don't have —
  // they hand PDFs to the system viewer. The browser says so itself via
  // `navigator.pdfViewerEnabled`; where it can't, "open" is the same
  // hand-off: the file, which the device then shows in its own viewer.
  function openPdf(file: Blob) {
    const canShowInline = navigator.pdfViewerEnabled ?? window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (canShowInline && window.matchMedia('(min-width: 640px)').matches) setPreview(file);
    else saveBlob(file, filename);
  }

  async function withPdf(use: (file: Blob) => void) {
    if (busy || empty) return;
    setBusy(true);
    try {
      use(await buildReportPdf(hotelName, copy, rows));
    } catch (error) {
      console.error('Could not create the report PDF:', error);
      toast.error(t('reports.pdfFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Menu.Root modal={false}>
        <Menu.Trigger
          openOnHover
          delay={80}
          closeDelay={150}
          aria-label={t('reports.rowActions', { label })}
          className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-stone hover:text-foreground data-popup-open:bg-stone data-popup-open:text-foreground"
        >
          {busy ? (
            <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <EllipsisHorizontalIcon className="size-5" aria-hidden="true" />
          )}
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50 outline-none">
            <Menu.Popup className="min-w-48 rounded-2xl border border-border bg-card p-1.5 text-foreground shadow-soft outline-none">
              <Menu.Item
                disabled={empty || busy}
                onClick={() => void withPdf(openPdf)}
                closeOnClick
                className={menuItemClass}
              >
                <DocumentMagnifyingGlassIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex flex-col py-2 text-left">
                  {t('reports.openPdf')}
                  {empty ? <span className="text-xs text-muted-foreground">{t('reports.noResults')}</span> : null}
                </span>
              </Menu.Item>
              <Menu.Item
                disabled={empty || busy}
                onClick={() => void withPdf((file) => saveBlob(file, filename))}
                closeOnClick
                className={menuItemClass}
              >
                <ArrowDownTrayIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {t('reports.downloadPdf')}
              </Menu.Item>
              <Menu.LinkItem render={<Link href={href} />} closeOnClick className={menuItemClass}>
                <DocumentTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {t('reports.openReport')}
              </Menu.LinkItem>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <ReportPdfPreview file={preview} title={label} filename={filename} onClose={closePreview} />
    </>
  );
}
