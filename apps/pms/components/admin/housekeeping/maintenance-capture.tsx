'use client';

import * as React from 'react';
import { GlobeAltIcon } from '@heroicons/react/24/outline';
import { ScanModal } from '@/components/admin/content/scan-modal';
import { useAdminT } from '@/lib/i18n/admin/context';
import type { MaintenanceAttachment } from '@/lib/application/maintenance-photo';
import { pill } from '@/lib/ui';

export function MaintenanceCapture({ disabled, onCapture, onOpenChange }: {
  disabled?: boolean;
  onCapture: (attachment: MaintenanceAttachment) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useAdminT();
  const [open, setOpen] = React.useState(false);
  function changeOpen(value: boolean) { setOpen(value); onOpenChange?.(value); }
  return <>
    <button type="button" disabled={disabled} onClick={() => changeOpen(true)} className={pill('secondary', 'min-h-12 justify-center')}>
      <GlobeAltIcon className="size-5" aria-hidden="true" />{t('maintenance.capture360')}
    </button>
    <ScanModal open={open} onClose={() => changeOpen(false)} title={t('maintenance.captureTitle')}
      intro={t('maintenance.captureIntro')} tour initialMode="tour" confirmLabel={t('maintenance.useCapture')}
      onCapture={(file, panorama) => {
        onCapture({ file: panorama ?? file, view: panorama ? '360' : 'photo' });
        changeOpen(false);
      }} />
  </>;
}
