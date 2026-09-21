import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { teamService } from '@/lib/application/container';
import { getAdminT } from '@/lib/i18n/admin/server';
import { adminPageTitle } from '@/lib/i18n/admin/translate';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { RoleEditor } from '@/components/admin/settings/role-editor';
import { roleLabel } from '@/components/admin/settings/team-data';

export const dynamic = 'force-dynamic';

async function loadRole(id: string) {
  const roles = await teamService.listRoles();
  const role = roles.find((candidate) => candidate.id === decodeURIComponent(id));
  return role ? { role, roles } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const [{ id }, t] = await Promise.all([params, getAdminT()]);
  const found = await loadRole(id);
  const title = found ? roleLabel(found.role.id, found.roles, t) : t('team.roles');
  return { title: adminPageTitle(t, title) };
}

export default async function RoleEditPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t] = await Promise.all([params, getAdminT()]);
  const found = await loadRole(id);
  if (!found) notFound();
  const title = roleLabel(found.role.id, found.roles, t);

  return (
    <AdminPage width="narrow">
      <AdminPageHeader
        breadcrumbs={[
          { label: t('nav.team'), href: '/admin/settings/team' },
          { label: t('team.roles'), href: '/admin/settings/team/roles' },
        ]}
        title={title}
        description={t('team.editRole')}
      />
      <div className="mt-8">
        <RoleEditor role={found.role} />
      </div>
    </AdminPage>
  );
}
