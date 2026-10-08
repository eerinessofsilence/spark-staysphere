'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { TrashIcon } from '@heroicons/react/24/outline';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';

export function MaintenancePhotoRemove({ href, number }: { href: string; number: number }) {
  const t = useAdminT();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(false);
  const lock = React.useRef(false);
  async function remove() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(false);
    try {
      const response = await fetch(href, { method: 'DELETE' });
      if (!response.ok) { setError(true); return; }
      router.refresh();
    } catch { setError(true); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="mt-2">
    <button type="button" disabled={busy} onClick={() => void remove()} aria-label={t('maintenance.removePhoto', { number })}
      className={pill('secondary', 'min-h-11')}><TrashIcon className="size-4" aria-hidden="true" />{t(busy ? 'maintenance.saving' : 'maintenance.deletePhoto')}</button>
    {error ? <p role="alert" className="mt-2 text-sm text-danger">{t('maintenance.photoDeleteFailed')}</p> : null}
  </div>;
}
