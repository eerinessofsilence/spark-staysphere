import * as React from 'react';
import type { ReportPdfCopy, ReportPdfRow } from './report-pdf-document';

let fontsRegistered = false;

async function registerReportFonts() {
  if (fontsRegistered) return;
  const { Font } = await import('@react-pdf/renderer');
  Font.register({
    family: 'Report Inter',
    fonts: [
      { src: new URL('/fonts/Inter-Regular.otf', window.location.origin).href, fontWeight: 400 },
      { src: new URL('/fonts/Inter-SemiBold.otf', window.location.origin).href, fontWeight: 600 },
    ],
  });
  fontsRegistered = true;
}

/**
 * Renders a report to a PDF blob in the browser — the one path behind
 * "Download PDF" and the grid row's "Open PDF". `@react-pdf/renderer` and
 * the document are imported here, on demand, so neither lands in a page's
 * bundle before someone asks for a PDF (same as `MenuPdfButton`).
 */
async function loadLogo(logoUrl?: string): Promise<string | null> {
  if (!logoUrl) return null;
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    const objectUrl = URL.createObjectURL(await response.blob());
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('Could not load hotel logo'));
        element.src = objectUrl;
      });
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 900 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    // A missing logo must not prevent the report from being downloaded.
    return null;
  }
}

export async function buildReportPdf(hotelName: string, copy: ReportPdfCopy, rows: ReportPdfRow[], logoUrl?: string): Promise<Blob> {
  const [{ Document, pdf }, { ReportPdf }] = await Promise.all([import('@react-pdf/renderer'), import('./report-pdf-document')]);
  await registerReportFonts();
  const logoData = await loadLogo(logoUrl);
  return pdf(
    React.createElement(
      Document,
      { title: `${hotelName} - ${copy.title}`, author: hotelName },
      React.createElement(ReportPdf, { hotelName, logoData, copy, rows }),
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
