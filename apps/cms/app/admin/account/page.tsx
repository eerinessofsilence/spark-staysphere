import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { AdminThemeToggle } from '@/components/admin/shell/admin-theme-toggle';
import { LanguageSettings } from '@/components/admin/settings/language-settings';
import { SignOutButton } from '@/components/admin/settings/session-settings';
import { requireAdminSession } from '@/lib/application/admin-session';
import { getAdminT } from '@/lib/i18n/admin/server';

export default async function AccountPage() {
  const session = await requireAdminSession();
  const t = await getAdminT();
  return <AdminPage width="narrow">
    <AdminPageHeader title={t('account.title')} actions={<SignOutButton />} />
    <div className="mt-8 grid gap-6 pb-24">
      <div className="rounded-[18px] bg-card p-6 shadow-soft">
        <h2 className="text-lg font-medium">{t('account.role')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t(session.role === 'admin' ? 'role.admin' : 'role.contentEditor')}</p>
        <p className="mt-5 text-sm text-muted-foreground">{t('account.passwordBody')}</p>
      </div>
      <LanguageSettings />
      <div className="rounded-[18px] bg-card p-6 shadow-soft"><AdminThemeToggle labelled /></div>
    </div>
  </AdminPage>;
}
