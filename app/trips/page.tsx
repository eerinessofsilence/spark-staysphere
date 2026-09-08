import type { Metadata } from 'next';
import { buildQuery, parseCriteria } from '@/lib/application/search-params';
import { TripsView } from '@/components/trips/trips-view';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';

export const metadata: Metadata = {
  title: 'My trips — Asteria Cove | SPARK StaySphere 360',
  description: 'The demo bookings this browser has made at Asteria Cove.',
};

/**
 * The guest's own bookings. Until there are accounts (see CLAUDE.md) "own"
 * means the references this browser holds, plus any claimed with a reference
 * and the email it was booked with — the same way a hotel desk will look a
 * stay up for someone who never made an account.
 */
export default async function TripsPage({ searchParams }: PageProps<'/trips'>) {
  const criteria = parseCriteria(await searchParams);
  const stayQuery = buildQuery({ criteria });

  return (
    <>
      <SiteHeader stayQuery={stayQuery} />
      <main id="main" className="mx-auto max-w-[1000px] px-3 py-8 sm:px-6 lg:py-12">
        <header className="max-w-2xl">
          <h1 className="text-display text-5xl sm:text-6xl">My trips</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            Every demo booking made in this browser. Nothing is charged and no account is needed —
            the stays live in this demo&apos;s memory and are listed here by their reference.
          </p>
        </header>

        <TripsView stayQuery={stayQuery} />
      </main>
      <SiteFooter stayQuery={stayQuery} />
    </>
  );
}
