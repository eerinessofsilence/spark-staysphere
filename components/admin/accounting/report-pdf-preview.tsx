'use client';

import * as React from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';
import { Modal } from '@/components/site/modal';
import { saveBlob } from './report-pdf-client';

/**
 * The PDF itself, opened in the product's own dialog rather than a new tab —
 * a popup blocker never gets a say, and the browser's viewer inside the frame
 * still brings its own zoom, print and save. The blob URL lives exactly as
 * long as the dialog does.
 */
export function ReportPdfPreview({
  file,
  title,
  filename,
  onClose,
}: {
  /** `null` closes the dialog. */
  file: Blob | null;
  title: string;
  filename: string;
  onClose: () => void;
}) {
  const t = useAdminT();
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  return (
    <Modal open={Boolean(file)} onClose={onClose} title={title} className="sm:max-w-4xl">
      <div className="flex flex-col gap-4">
        {url ? (
          <iframe
            src={url}
            title={title}
            className="h-[60dvh] w-full rounded-[18px] border border-border bg-stone"
          />
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className={pill('secondary')}>
            {t('frontDesk.cancel')}
          </button>
          <button type="button" onClick={() => file && saveBlob(file, filename)} className={pill('primary')}>
            <ArrowDownTrayIcon className="size-4" aria-hidden="true" />
            {t('reports.downloadPdf')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
