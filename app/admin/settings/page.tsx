import type { Metadata } from 'next';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const metadata: Metadata = { title: 'Brand & domain — Hotel admin | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <AdminPage>
      <AdminPageHeader title="Brand & domain" description="How the booking site looks and where it lives." />
    </AdminPage>
  );
}
