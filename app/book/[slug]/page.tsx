import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Warning } from '@phosphor-icons/react/dist/ssr';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { RoomNotFoundError } from '@/lib/application/catalog-service';
import { catalogService, DEMO_HOTEL_SLUG, inventoryService } from '@/lib/application/container';
import {
  buildQuery,
  parseAddOnIds,
  parseCriteria,
  parseRoomNumber,
  toIsoDate,
} from '@/lib/application/search-params';
import { BookingFlow } from '@/components/booking/booking-flow';
import { pill } from '@/lib/ui';
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
  const requestedRoom = parseRoomNumber(query);
  const roomIsFree = requestedRoom
    ? await inventoryService.isUnitFreeForStay(
        DEMO_HOTEL_SLUG,
        detail.offer.room.id,
        requestedRoom,
        criteria.checkIn,
        criteria.checkOut,
      )
    : false;
  const roomNumber = requestedRoom && roomIsFree ? requestedRoom : null;

  return (
    <>
      <SiteHeader stayQuery={buildQuery({ criteria })} />
      <main id="main" className="container-page py-8 lg:py-12">
        <nav aria-label="Breadcrumb" className="mb-5 text-sm">
          <Link href={`/rooms/${detail.offer.room.slug}?${stayQuery}`} className={pill('secondary')}>
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            Back to {detail.offer.room.name}
          </Link>
        </nav>

        <header className="mb-8 max-w-2xl">
          <h1 className="text-display text-5xl sm:text-6xl">Complete your stay</h1>
          <p className="mt-4 text-base text-muted-foreground">
            Six short steps. Nothing is charged, no card details are collected, and the price is
            rechecked on the server before the booking is created.
          </p>
        </header>

        {requestedRoom && !roomNumber ? (
          <div
            role="status"
            className="mb-6 flex items-start gap-3 rounded-3xl border border-warning/30 bg-warning/10 p-4 text-sm"
          >
            <Warning weight="fill" className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            <p>
              <span className="font-medium">
                Room {requestedRoom} is no longer free for these dates.
              </span>{' '}
              We&apos;ll book any {detail.offer.room.name} instead, or{' '}
              <Link
                href={`/rooms?${buildQuery({ criteria, layout: 'plan' })}`}
                className="font-medium underline underline-offset-2"
              >
                pick another room on the floor plan
              </Link>
              .
            </p>
          </div>
        ) : null}

        <BookingFlow
          hotel={detail.hotel}
          room={detail.offer.room}
          ratePlan={detail.offer.ratePlan}
          addOns={detail.addOns}
          criteria={criteria}
          initialQuote={detail.quote}
          initialAddOnIds={detail.quote.addOnIds}
          minDate={toIsoDate(new Date())}
          roomNumber={roomNumber}
        />
      </main>
      <SiteFooter stayQuery={stayQuery} />
    </>
  );
}
