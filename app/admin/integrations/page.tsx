import type { Metadata } from 'next';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const metadata: Metadata = { title: 'Integrations — Hotel admin | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

export default function IntegrationsPage() {
  return (
    <AdminPage>
      <AdminPageHeader title="Integrations" description="The systems this site reads inventory from and writes bookings to." />
    </AdminPage>
  );
}
