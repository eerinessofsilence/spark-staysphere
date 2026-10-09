'use client';

import Link from 'next/link';
import { Warning } from '@phosphor-icons/react/dist/ssr';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { buildQuery } from '@/lib/application/search-params';
import type { AddOn, Hotel, Quote, RatePlan, RoomType, StayCriteria } from '@/lib/domain/schemas';
import { useT } from '@/lib/i18n/context';
import { pill } from '@/lib/ui';
import { BookingFlow } from '@/components/booking/booking-flow';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';

interface BookViewProps {
  hotel: Hotel;
  room: RoomType;
  ratePlan: RatePlan;
  addOns: AddOn[];
  criteria: StayCriteria;
  initialQuote: Quote;
  initialAddOnIds: string[];
  minDate: string;
  roomNumber: string | null;
  requestedRoom: string | null;
  stayQuery: string;
}

export function BookView({
  hotel,
  room,
  ratePlan,
  addOns,
  criteria,
  initialQuote,
  initialAddOnIds,
  minDate,
  roomNumber,
  requestedRoom,
  stayQuery,
}: BookViewProps) {
  const t = useT();

  return (
    <>
      <SiteHeader stayQuery={buildQuery({ criteria })} />
      <main id="main" className="container-page py-8 lg:py-12">
        <nav aria-label="Breadcrumb" className="mb-5 text-sm">
          <Link href={`/rooms/${room.slug}?${stayQuery}`} className={pill('secondary')}>
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            {t('book.backTo', { room: room.name })}
          </Link>
        </nav>

        <header className="mb-8 max-w-2xl">
          <h1 className="text-display text-5xl sm:text-6xl">{t('book.completeYourStay')}</h1>
          <p className="mt-4 text-base text-muted-foreground">{t('book.sixSteps')}</p>
        </header>

        {requestedRoom && !roomNumber ? (
          <div
            role="status"
            className="mb-6 flex items-start gap-3 rounded-3xl border border-warning/30 bg-warning/10 p-4 text-sm"
          >
            <Warning weight="fill" className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            <p>
              <span className="font-medium">{t('book.roomNoLongerFree', { number: requestedRoom })}</span>{' '}
              {t('book.willBookAnyInstead', { room: room.name })}{' '}
              <Link
                href={`/rooms?${buildQuery({ criteria, layout: 'plan' })}`}
                className="font-medium underline underline-offset-2"
              >
                {t('book.pickAnotherOnPlan')}
              </Link>
              .
            </p>
          </div>
        ) : null}

        <BookingFlow
          hotel={hotel}
          room={room}
          ratePlan={ratePlan}
          addOns={addOns}
          criteria={criteria}
          initialQuote={initialQuote}
          initialAddOnIds={initialAddOnIds}
          minDate={minDate}
          roomNumber={roomNumber}
        />
      </main>
      <SiteFooter stayQuery={stayQuery} />
    </>
  );
}
