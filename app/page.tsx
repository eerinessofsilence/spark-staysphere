import Link from 'next/link';
import { ArrowRightIcon, ArrowUpRightIcon } from '@heroicons/react/24/outline';
import { defaultRoomFilters } from '@/lib/application/catalog-service';
import { catalogService, DEMO_HOTEL_SLUG } from '@/lib/application/container';
import { buildQuery, parseCriteria, toIsoDate } from '@/lib/application/search-params';
import { formatDateRange, formatMoney } from '@/lib/formatting';
import { pill } from '@/lib/ui';
import { HotelScene } from '@/components/hotel/hotel-scene';
import { RoomCard } from '@/components/rooms/room-card';
import { RoomStrip } from '@/components/rooms/room-strip';
import { StaySearchBar } from '@/components/search/stay-search-bar';
import { SectionLabel } from '@/components/site/section-label';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';

export default async function HomePage({ searchParams }: PageProps<'/'>) {
  const params = await searchParams;
  const criteria = parseCriteria(params);
  const stayQuery = buildQuery({ criteria });
  const today = toIsoDate(new Date());

  const { hotel, offers, availableRooms, totalRooms, facets } = await catalogService.search(
    DEMO_HOTEL_SLUG,
    criteria,
    defaultRoomFilters,
  );
  const highlights = offers.slice(0, 3);
  const rest = offers.slice(3);

  // What the arrival markers may say about a room: the floor from the catalog,
  // the price from the same breakdown every other screen shows.
  const roomFacts = Object.fromEntries(
    offers.map((offer) => [
      offer.room.slug,
      {
        name: offer.room.name,
        areaM2: offer.room.areaM2,
        floor: offer.room.floor,
        capacity: offer.room.capacity,
        bedType: offer.room.bedType,
        nightlyPrice: offer.price.nightlyPrice,
        currency: offer.price.currency,
      },
    ]),
  );

  return (
    <>
      <SiteHeader
        stayQuery={stayQuery}
        search={<StaySearchBar criteria={criteria} minDate={today} size="compact" />}
      />
      <main id="main">
        {/* Arrival */}
        <section className="mx-auto max-w-[1400px] px-3 pt-8 sm:px-6 lg:pt-14">
          <h1 className="sr-only">{hotel.name}</h1>

          <HotelScene areas={hotel.areas} location={hotel.location} stayQuery={stayQuery} rooms={roomFacts} />

          <div className="mt-5 sm:px-6 lg:px-12">
            <h2 className="sr-only">Search rooms</h2>
            {/* From `lg` the same search rides in the header instead. */}
            <div className="lg:hidden">
              <StaySearchBar criteria={criteria} minDate={today} />
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {availableRooms} of {totalRooms} room types are available for{' '}
              {formatDateRange(criteria.checkIn, criteria.checkOut)}, from{' '}
              {formatMoney(facets.priceRange.min, hotel.currency)} a night.
            </p>
          </div>
        </section>

        {/* Recommended rooms */}
        <section aria-labelledby="rooms-heading" className="mx-auto mt-20 max-w-[1400px] px-3 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionLabel>Recommended for your dates</SectionLabel>
              <h2 id="rooms-heading" className="text-display mt-3 text-4xl sm:text-5xl">
                Where to stay
              </h2>
            </div>
            <Link href={`/rooms?${stayQuery}`} className={pill('secondary')}>
              All {totalRooms} room types
              <ArrowUpRightIcon className="size-4" aria-hidden="true" />
            </Link>
          </div>

          {highlights.length === 0 ? (
            <p className="mt-8 rounded-[28px] border border-dashed border-border p-10 text-center text-muted-foreground">
              Nothing is bookable for those dates. Try a different stay above.
            </p>
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {highlights.map((offer) => (
                <RoomCard key={offer.room.id} offer={offer} stayQuery={stayQuery} />
              ))}
            </div>
          )}
        </section>

        {/* Closing band */}
        <section className="mx-auto mt-20 max-w-[1400px] px-3 sm:px-6">
          <div className="relative overflow-hidden rounded-[28px]">
            <img
              src="/images/hotel/pool.webp"
              alt=""
              width={2000}
              height={1334}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 size-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />
            <div className="relative flex flex-col items-start gap-6 p-8 text-[#F7F5F0] sm:p-12 lg:min-h-[24rem] lg:justify-end">
              <p className="text-display max-w-xl text-4xl sm:text-5xl">
                Take the whole journey, <span className="text-accent-italic text-accent-strong">end to end.</span>
              </p>
              <p className="max-w-md text-sm leading-relaxed text-white/75">
                Search, inspect a room, add services, and confirm. Payment is simulated and clearly
                labelled — no card details are ever collected.
              </p>
              <Link href={`/rooms?${stayQuery}`} className={pill('glass')}>
                Start with the rooms
                <ArrowRightIcon className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* The rest of the house, on the way out */}
        {rest.length > 0 ? (
          <section aria-labelledby="rest-heading" className="mx-auto mt-20 max-w-[1400px] px-3 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <SectionLabel>Also at {hotel.name}</SectionLabel>
                <h2 id="rest-heading" className="text-display mt-3 text-4xl sm:text-5xl">
                  The other rooms
                </h2>
              </div>
              <Link href={`/rooms?${stayQuery}`} className={pill('secondary')}>
                Compare all {totalRooms}
                <ArrowUpRightIcon className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <RoomStrip offers={rest} stayQuery={stayQuery} className="mt-8" />
          </section>
        ) : null}
      </main>
      <SiteFooter stayQuery={stayQuery} />
    </>
  );
}
