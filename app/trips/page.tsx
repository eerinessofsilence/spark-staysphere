import type { Metadata } from 'next';
import { buildQuery, parseCriteria } from '@/lib/application/search-params';
import { TripsPageView } from '@/components/trips/trips-page-view';

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

  return <TripsPageView stayQuery={stayQuery} />;
}
