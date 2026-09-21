import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/application/admin-session';
import { getAdminT } from '@/lib/i18n/admin/server';
import { adminPageTitle } from '@/lib/i18n/admin/translate';
import { AccountTabs } from '@/components/admin/settings/account-tabs';
import { SignOutButton } from '@/components/admin/settings/session-settings';
import { SubscriptionSettings } from '@/components/admin/settings/subscription-settings';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getAdminT();
  return { title: adminPageTitle(t, `${t('account.subscription')} — ${t('account.title')}`) };
}

export default async function AccountSubscriptionPage() {
  const t = await getAdminT();
  // The layout has already turned away anyone without a session; this only narrows the type.
  const session = await getAdminSession();
  if (!session) redirect('/admin/sign-in');

  return (
    <AdminPage width="narrow">
      <AdminPageHeader title={t('account.title')} actions={<SignOutButton />} />
      <AccountTabs current="subscription" />

      <div className="mt-8">
        <h2 className="text-display text-2xl">{t('account.subscription')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('account.subscriptionBody')}</p>
        <div className="mt-6">
          <SubscriptionSettings />
        </div>
      </div>
    </AdminPage>
  );
}
