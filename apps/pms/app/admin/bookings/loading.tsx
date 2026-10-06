'use client';

import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminT } from '@/lib/i18n/admin/context';

export default function BookingsLoading() {
  const t = useAdminT();

  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="sr-only">{t('page.loading')}</span>
      <AdminPage>
        <div aria-hidden="true">
          <AdminPageHeader title={t('nav.reservations')} />
          <div className="mt-6 flex flex-wrap gap-3">
            <Skeleton className="h-11 w-60 max-w-full rounded-full" />
            <Skeleton className="h-11 w-36 rounded-full" />
          </div>
          <Skeleton className="mt-5 h-10 w-full max-w-lg rounded-full" />
          <div className="mt-5 overflow-hidden rounded-[18px] border border-border bg-card">
            {Array.from({ length: 7 }, (_, index) => (
              <div key={index} className="flex h-20 items-center gap-4 border-b border-border px-4 last:border-b-0 sm:px-6">
                <Skeleton className="h-4 w-20 shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-40 max-w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="hidden h-4 w-28 md:block" />
                <Skeleton className="hidden h-8 w-24 rounded-full sm:block" />
              </div>
            ))}
          </div>
        </div>
      </AdminPage>
    </div>
  );
}
