import type { Metadata } from 'next';
import { tag } from '@/lib/ui';
import { AccountSettings } from '@/components/admin/settings/account-settings';
import { SubscriptionSettings } from '@/components/admin/settings/subscription-settings';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const metadata: Metadata = { title: 'Account — Hotel admin | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

export default function AccountPage() {
  return (
    <AdminPage width="narrow">
      <AdminPageHeader
        title="Account"
        actions={<span className={tag()}>Preview — changes aren't saved in this demo</span>}
      />
      <div className="mt-10">
        <AccountSettings />
      </div>

      <h2 className="text-display mt-12 text-2xl">Subscription</h2>
      <p className="mt-1 text-sm text-muted-foreground">The hotel's own plan on StaySphere.</p>
      <div className="mt-6">
        <SubscriptionSettings />
      </div>
    </AdminPage>
  );
}
