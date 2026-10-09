'use client';

import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { SiteHeader } from './site-header';

export function GuestLoadingFrame({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  return (
    <>
      <SiteHeader stayQuery={searchParams?.toString()} />
      <main id="main" className="route-loading container-page py-8 lg:py-12">
        {children}
      </main>
    </>
  );
}
