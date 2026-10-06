import type { Metadata } from 'next';
import { teamService } from '@/lib/application/container';
import { getAdminT } from '@/lib/i18n/admin/server';
import { adminPageTitle } from '@/lib/i18n/admin/translate';
import { AdminPage } from '@/components/admin/shell/admin-page';
import { PermissionsMatrix } from '@/components/admin/settings/permissions-matrix';
import { RolesSection } from '@/components/admin/settings/roles-section';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAdminT();
  return { title: adminPageTitle(t, `${t('team.roles')} — ${t('team.title')}`) };
}

export default async function TeamRolesPage() {
  const [roles, members] = await Promise.all([teamService.listRoles(), teamService.listMembers()]);
  return (
    <AdminPage>
      <RolesSection roles={roles} membersCount={members.length} />
      <div className="mt-12">
        <PermissionsMatrix roles={roles} />
      </div>
    </AdminPage>
  );
}
