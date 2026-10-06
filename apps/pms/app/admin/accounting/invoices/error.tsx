'use client';

import { Warning } from '@phosphor-icons/react/dist/ssr';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';

export default function InvoicesError({ reset }: { reset: () => void }) {
  const t = useAdminT();
  return <AdminPage>
    <AdminPageHeader title={t('booking.invoices')} />
    <div className="mt-6 rounded-[18px] bg-card p-6 shadow-soft">
      <p role="alert" className="flex items-center gap-2 text-sm"><Warning weight="fill" className="size-5 shrink-0 text-danger" aria-hidden="true" />{t('accounting.invoicesError')}</p>
      <button type="button" onClick={reset} className={pill('primary', 'mt-4')}>{t('accounting.invoicesRetry')}</button>
    </div>
  </AdminPage>;
}
