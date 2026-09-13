import type { Metadata } from 'next';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const metadata: Metadata = { title: 'Media library — Hotel admin | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

export default function MediaPage() {
  return (
    <AdminPage>
      <AdminPageHeader title="Media library" description="The photographs and 360° captures rooms, areas, and add-ons can use." />
    </AdminPage>
  );
}
