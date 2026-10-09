import type { Metadata } from 'next';
import { availableHotels, teamService } from '@/lib/application/container';
import { getAdminT } from '@/lib/i18n/admin/server';
import { adminPageTitle } from '@/lib/i18n/admin/translate';
import { AdminPage } from '@/components/admin/shell/admin-page';
import { TeamMembers } from '@/components/admin/settings/team-members';
import { getAdminMember } from '@/lib/application/admin-session';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAdminT();
  return { title: adminPageTitle(t, t('team.title')) };
}

export default async function TeamPage() {
  const [roles, members] = await Promise.all([teamService.listRoles(), teamService.listMembers()]);
  const actor = await getAdminMember();
  const canManage = Boolean(actor && await teamService.hasPermission(actor.role, 'team.permTeamRoles'));
  return (
    <AdminPage>
      <TeamMembers initialMembers={members} roles={roles} hotels={availableHotels.map(({ id, name }) => ({ id, name }))} canManage={canManage} />
    </AdminPage>
  );
}
