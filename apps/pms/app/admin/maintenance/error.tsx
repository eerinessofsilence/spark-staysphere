'use client';

import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';

export default function MaintenanceError({ reset }: { reset: () => void }) {
  const t = useAdminT();
  return <AdminPage>
    <AdminPageHeader title={t('maintenance.unavailable')} />
    <p role="alert" className="mt-4 text-sm text-muted-foreground">{t('maintenance.unavailableBody')}</p>
    <button type="button" onClick={reset} className={pill('primary', 'mt-4')}>{t('maintenance.retry')}</button>
  </AdminPage>;
}
