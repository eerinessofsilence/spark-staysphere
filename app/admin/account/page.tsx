import type { Metadata } from 'next';
import { tag } from '@/lib/ui';
import { AccountSettings } from '@/components/admin/settings/account-settings';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const metadata: Metadata = { title: 'Account — Hotel admin | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

export default function AccountPage() {
  return (
    <AdminPage width="narrow">
      <AdminPageHeader
        title="Account"
        compact
        actions={<span className={tag()}>Preview — changes aren't saved in this demo</span>}
      />
      <div className="mt-10">
        <AccountSettings />
      </div>
    </AdminPage>
  );
}
