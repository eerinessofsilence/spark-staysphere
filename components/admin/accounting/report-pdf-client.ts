import * as React from 'react';
import type { ReportPdfCopy, ReportPdfRow } from './report-pdf-document';

/**
 * Renders a report to a PDF blob in the browser — the one path behind
 * "Download PDF" and the grid row's "Open PDF". `@react-pdf/renderer` and
 * the document are imported here, on demand, so neither lands in a page's
 * bundle before someone asks for a PDF (same as `MenuPdfButton`).
 */
export async function buildReportPdf(hotelName: string, copy: ReportPdfCopy, rows: ReportPdfRow[]): Promise<Blob> {
  const [{ Document, pdf }, { ReportPdf }] = await Promise.all([import('@react-pdf/renderer'), import('./report-pdf-document')]);
  return pdf(
    React.createElement(
      Document,
      { title: `${hotelName} - ${copy.title}`, author: hotelName },
      React.createElement(ReportPdf, { hotelName, copy, rows }),
    ),
  ).toBlob();
}

/** Hands the blob to the browser as a file save. The object URL outlives the click long enough for the download to start. */
export function saveBlob(file: Blob, filename: string): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
