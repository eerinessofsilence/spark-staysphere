import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { getAdminT } from '@/lib/i18n/admin/server';
import { Preloader } from '@/components/ui/preloader';

export default async function MaintenanceLoading() {
  const t = await getAdminT();
  return <div className="route-loading"><AdminPage loading>
    <AdminPageHeader title={t('nav.maintenance')} />
    <div className="mt-6 rounded-[18px] bg-card p-6 shadow-soft">
      <Preloader label={t('maintenance.loading')} size="page" delay={0} />
    </div>
  </AdminPage></div>;
}
