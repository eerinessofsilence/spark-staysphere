import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/application/admin-session';
import { teamService } from '@/lib/application/container';
import { getAdminT } from '@/lib/i18n/admin/server';
import { adminPageTitle } from '@/lib/i18n/admin/translate';
import { AccountSettings } from '@/components/admin/settings/account-settings';
import { LanguageSettings } from '@/components/admin/settings/language-settings';
import { InterestsSettings, SignOutButton } from '@/components/admin/settings/session-settings';
import { TourSettings } from '@/components/admin/settings/tour-settings';
import { SubscriptionSettings } from '@/components/admin/settings/subscription-settings';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAdminT();
  return { title: adminPageTitle(t, t('account.title')) };
}

export default async function AccountPage() {
  const t = await getAdminT();
  // The layout has already turned away anyone without a session; this only narrows the type.
  const session = await getAdminSession();
  const member = session ? await teamService.findMemberById(session.memberId) : null;
  if (!session || !member) redirect('/admin/sign-in');
  const roles = await teamService.listRoles();

  return (
    <AdminPage width="narrow">
      <AdminPageHeader title={t('account.title')} actions={<SignOutButton />} />
      <div className="mt-10 grid gap-6">
        <AccountSettings member={member} roles={roles} />
        <InterestsSettings interests={session.interests} />
        <LanguageSettings />
        <TourSettings />
      </div>

      <h2 className="text-display mt-12 text-2xl">{t('account.subscription')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('account.subscriptionBody')}</p>
      <div className="mt-6">
        <SubscriptionSettings />
      </div>
    </AdminPage>
  );
}
