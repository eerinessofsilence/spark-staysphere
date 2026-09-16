'use client';

import { useT } from '@/lib/i18n/context';
import { AssistantLauncher } from '@/components/assistant/assistant-launcher';
import { TripsView } from '@/components/trips/trips-view';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';

export function TripsPageView({ stayQuery }: { stayQuery: string }) {
  const t = useT();

  return (
    <>
      <SiteHeader stayQuery={stayQuery} />
      <main id="main" className="container-reading py-8 lg:py-12">
        <header className="max-w-2xl">
          <h1 className="text-display text-4xl sm:text-5xl">{t('trips.myTrips')}</h1>
        </header>

        <TripsView stayQuery={stayQuery} />
      </main>
      <SiteFooter stayQuery={stayQuery} />
      <AssistantLauncher />
    </>
  );
}
