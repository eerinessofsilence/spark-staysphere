import { AccountingTabs } from '@/components/admin/accounting/accounting-tabs';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { getAdminT } from '@/lib/i18n/admin/server';
import { Preloader } from '@/components/ui/preloader';

export default async function LoadingInvoices() {
  const t = await getAdminT();
  return <div className="route-loading"><AdminPage loading>
    <AdminPageHeader title={t('nav.accounting')} />
    <AccountingTabs current="invoices" />
    <h2 className="text-display mt-8 text-2xl sm:text-3xl">{t('booking.invoices')}</h2>
    <Preloader label={t('accounting.invoicesLoading')} size="page" delay={0} />
    <div className="mt-5 overflow-hidden rounded-[18px] bg-card shadow-soft" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => <div key={index} className="flex h-20 items-center gap-8 border-b border-border px-4 last:border-b-0">
        <div className="h-4 w-24 rounded-full bg-stone" /><div className="h-4 w-40 rounded-full bg-stone" /><div className="ml-auto h-4 w-20 rounded-full bg-stone" />
      </div>)}
    </div>
  </AdminPage></div>;
}
