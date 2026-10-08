'use client';

import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { Skeleton } from '@/components/ui/skeleton';
import { Preloader } from '@/components/ui/preloader';
import { useAdminT } from '@/lib/i18n/admin/context';

/** Default back-office fallback, below the persistent sidebar and top bar. */
export default function AdminLoading() {
  const t = useAdminT();

  return (
    <div className="route-loading">
      <AdminPage loading>
        <Preloader label={t('page.loading')} size="page" delay={0} />
        <div aria-hidden="true">
          <AdminPageHeader title={t('page.hotelAdmin')} />
          <Skeleton className="mt-6 h-11 w-full max-w-md rounded-full" />
          <div className="mt-6 overflow-hidden rounded-[18px] border border-border bg-card">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex min-h-20 items-center gap-4 border-b border-border px-4 last:border-b-0 sm:px-6">
                <Skeleton className="size-11 shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-48 max-w-full" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="hidden h-4 w-24 sm:block" />
              </div>
            ))}
          </div>
        </div>
      </AdminPage>
    </div>
  );
}
