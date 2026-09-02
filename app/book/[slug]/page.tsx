import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr';
import { RoomNotFoundError } from '@/lib/application/catalog-service';
import { catalogService, DEMO_HOTEL_SLUG } from '@/lib/application/container';
import { buildQuery, parseAddOnIds, parseCriteria, toIsoDate } from '@/lib/application/search-params';
import { BookingFlow } from '@/components/booking/booking-flow';
import { SectionLabel } from '@/components/site/section-label';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';

export const metadata: Metadata = {
  title: 'Book your stay — Asteria Cove | SPARK StaySphere 360',
  description: 'Complete a clearly labelled demo booking at Asteria Cove.',
};

export default async function BookPage({ params, searchParams }: PageProps<'/book/[slug]'>) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const criteria = parseCriteria(query);
  const addOnIds = parseAddOnIds(query);

  const detail = await catalogService
    .getRoomDetail(DEMO_HOTEL_SLUG, slug, criteria, addOnIds)
    .catch((error: unknown) => {
      if (error instanceof RoomNotFoundError) notFound();
      throw error;
    });

  const stayQuery = buildQuery({ criteria, addOnIds: detail.quote.addOnIds });

  return (
    <>
      <SiteHeader stayQuery={buildQuery({ criteria })} />
      <main id="main" className="mx-auto max-w-[1400px] px-3 py-8 sm:px-6 lg:py-12">
        <nav aria-label="Breadcrumb" className="mb-5 text-sm">
          <Link
            href={`/rooms/${detail.offer.room.slug}?${stayQuery}`}
            className="inline-flex min-h-11 items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft weight="bold" className="size-4" aria-hidden="true" />
            Back to {detail.offer.room.name}
          </Link>
        </nav>

        <header className="mb-8 max-w-2xl">
          <SectionLabel>Demo booking · {detail.hotel.name}</SectionLabel>
          <h1 className="text-display mt-4 text-5xl sm:text-6xl">Complete your stay</h1>
          <p className="mt-4 text-[15px] text-muted-foreground">
            Six short steps. Nothing is charged, no card details are collected, and the price is
            rechecked on the server before the booking is created.
          </p>
        </header>

        <BookingFlow
          hotel={detail.hotel}
          room={detail.offer.room}
          ratePlan={detail.offer.ratePlan}
          addOns={detail.addOns}
          criteria={criteria}
          initialQuote={detail.quote}
          initialAddOnIds={detail.quote.addOnIds}
          minDate={toIsoDate(new Date())}
        />
      </main>
      <SiteFooter />
    </>
  );
}
