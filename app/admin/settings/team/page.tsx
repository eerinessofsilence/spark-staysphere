import type { Metadata } from 'next';
import { tag } from '@/lib/ui';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { PermissionsMatrix } from '@/components/admin/settings/permissions-matrix';
import { TeamMembers } from '@/components/admin/settings/team-members';

export const metadata: Metadata = { title: 'Team & roles — Hotel admin | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

export default function TeamPage() {
  return (
    <AdminPage>
      <AdminPageHeader
        title="Team & roles"
        actions={<span className={tag()}>Demo — sign-in and roles arrive with admin auth</span>}
      />
      <div className="mt-10">
        <TeamMembers />
        <PermissionsMatrix />
      </div>
    </AdminPage>
  );
}
