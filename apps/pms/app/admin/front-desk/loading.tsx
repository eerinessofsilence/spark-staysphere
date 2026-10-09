'use client';

import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { Skeleton } from '@/components/ui/skeleton';
import { Preloader } from '@/components/ui/preloader';
import { useAdminT } from '@/lib/i18n/admin/context';

export default function FrontDeskLoading() {
  const t = useAdminT();

  return (
    <div className="route-loading">
      <AdminPage loading>
        <Preloader label={t('page.loading')} size="page" delay={0} />
        <div aria-hidden="true">
          <AdminPageHeader title={t('nav.frontDesk')} />
          <div className="mt-5 flex items-center gap-3">
            <Skeleton className="h-11 w-36 rounded-full" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="ml-auto h-11 w-11 rounded-full sm:w-28" />
          </div>
          <div className="mt-5 overflow-hidden rounded-[18px] border border-border bg-card">
            <div className="flex h-14 items-center gap-3 border-b border-border px-4">
              <Skeleton className="h-4 w-32 shrink-0" />
              <Skeleton className="h-4 flex-1" />
            </div>
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="flex h-20 items-center gap-4 border-b border-border px-4 last:border-b-0">
                <Skeleton className="h-4 w-20 shrink-0" />
                <Skeleton className="h-9 w-32 rounded-full sm:w-44" />
                <Skeleton className="hidden h-9 w-32 rounded-full sm:block" />
              </div>
            ))}
          </div>
        </div>
      </AdminPage>
    </div>
  );
}
