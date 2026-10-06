import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { teamService } from '@/lib/application/container';
import { getAdminT } from '@/lib/i18n/admin/server';
import { adminPageTitle } from '@/lib/i18n/admin/translate';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { TeamMemberEditor } from '@/components/admin/settings/team-member-editor';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const t = await getAdminT();
  const member = await teamService.findMemberById(decodeURIComponent(id));
  return { title: adminPageTitle(t, member?.name ?? t('team.title')) };
}

export default async function TeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getAdminT();
  const [member, roles] = await Promise.all([
    teamService.findMemberById(decodeURIComponent(id)),
    teamService.listRoles(),
  ]);
  if (!member) notFound();

  return (
    <AdminPage width="narrow">
      <AdminPageHeader
        breadcrumbs={[{ label: t('nav.team'), href: '/admin/settings/team' }]}
        title={member.name}
        description={member.email}
      />
      <div className="mt-8">
        <TeamMemberEditor member={member} roles={roles} />
      </div>
    </AdminPage>
  );
}
