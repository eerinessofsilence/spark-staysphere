import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { getAdminT } from '@/lib/i18n/admin/server';

export default async function MaintenanceLoading() {
  const t = await getAdminT();
  return <AdminPage>
    <AdminPageHeader title={t('nav.maintenance')} />
    <div role="status" aria-busy="true" className="mt-6 rounded-[18px] bg-card p-6 shadow-soft">
      <p className="text-sm text-muted-foreground">{t('maintenance.loading')}</p>
    </div>
  </AdminPage>;
}
