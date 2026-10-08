'use client';

import { useT } from '@/lib/i18n/context';
import { Skeleton } from '@/components/ui/skeleton';
import { Preloader } from '@/components/ui/preloader';
import { GuestLoadingFrame } from '@/components/site/guest-loading-frame';

export default function BookLoading() {
  const t = useT();
  return (
    <GuestLoadingFrame>
      <Preloader label={t('book.preparingBooking')} size="page" delay={0} />
      <Skeleton className="h-4 w-44" />
      <Skeleton className="mt-6 h-12 w-96 max-w-full" />
      <div className="mt-8 grid gap-8 lg:grid-cols-sidebar lg:gap-10">
        <div>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <Skeleton key={index} className="h-11 w-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="mt-8 h-80 rounded-[18px]" />
        </div>
        <Skeleton className="h-80 rounded-[18px]" />
      </div>
    </GuestLoadingFrame>
  );
}
