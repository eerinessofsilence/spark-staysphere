import type { Metadata } from 'next';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const metadata: Metadata = { title: 'Rates & availability — Hotel admin | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

export default function RatesPage() {
  return (
    <AdminPage>
      <AdminPageHeader title="Rates & availability" description="Base rates, what each rate includes, and which rooms are open to sell." />
    </AdminPage>
  );
}
