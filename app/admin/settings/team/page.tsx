import type { Metadata } from 'next';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const metadata: Metadata = { title: 'Team & roles — Hotel admin | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

export default function SettingsTeamPage() {
  return (
    <AdminPage>
      <AdminPageHeader title="Team & roles" description="Who can sign in to this admin, and what each role can change." />
    </AdminPage>
  );
}
