import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from '@phosphor-icons/react/dist/ssr';
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

const steps = [
  {
    title: 'See the stay',
    body: 'Walk the property area by area, then open the exact room type — its own photographs, floor, and outlook — before you commit to anything.',
  },
  {
    title: 'Shape it',
    body: 'Add a transfer, a spa ritual, or a late check-out. The booking engine reprices the stay the moment you change it.',
  },
  {
    title: 'Book direct',
    body: 'Confirm in a clearly labelled demo booking. Price and availability are rechecked on the server right before the reservation is created.',
  },
];

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

  return (
    <>
      <SiteHeader stayQuery={stayQuery} />
      <main id="main">
        {/* Arrival */}
        <section className="mx-auto max-w-[1400px] px-3 pt-8 sm:px-6 lg:pt-14">
          <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
            <div>
              <SectionLabel>{hotel.location}</SectionLabel>
              <h1 className="text-display mt-4 text-[clamp(3.25rem,10vw,8rem)]">{hotel.name}</h1>
            </div>
            <div className="lg:pb-3">
              <p className="text-accent-italic text-2xl text-accent-strong sm:text-3xl">{hotel.tagline}</p>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                A cliffside house above a working fishing cove on the Dalmatian coast. Explore the
                property, open the exact room you want, and book it direct.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={`/rooms?${stayQuery}`} className={pill('primary')}>
                  Explore rooms
                  <ArrowRight weight="bold" className="size-4" aria-hidden="true" />
                </Link>
                <Link href="#how-it-works" className={pill('secondary')}>
                  How it works
                </Link>
              </div>
            </div>
          </div>

          <HotelScene areas={hotel.areas} location={hotel.location} stayQuery={stayQuery} className="mt-8" />

          <div className="mt-5 sm:px-6 lg:px-12">
            <h2 className="sr-only">Search rooms</h2>
            <StaySearchBar criteria={criteria} minDate={today} />
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {availableRooms} of {totalRooms} room types are available for{' '}
              {formatDateRange(criteria.checkIn, criteria.checkOut)}, from{' '}
              {formatMoney(facets.priceRange.min, hotel.currency)} a night.
            </p>
          </div>
        </section>

        {/* How it works: three numbered steps over photography, not icon cards. */}
        <section
          id="how-it-works"
          aria-labelledby="how-heading"
          className="mx-auto mt-20 max-w-[1400px] scroll-mt-24 px-3 sm:px-6"
        >
          <div className="grid overflow-hidden rounded-[28px] bg-ink text-[#F7F5F0] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="relative min-h-[22rem] lg:min-h-[36rem]">
              <img
                src="/images/hotel/cove.webp"
                alt="A pool set into the cliff above a rocky Mediterranean cove"
                width={2000}
                height={3000}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 size-full object-cover"
              />
            </div>
            <div className="p-7 sm:p-10 lg:p-14">
              <SectionLabel tone="onDark">How it works</SectionLabel>
              <h2 id="how-heading" className="text-display mt-4 text-4xl sm:text-5xl">
                Nothing between you <span className="text-accent-italic text-accent-strong">and the room.</span>
              </h2>
              <ol className="mt-10 divide-y divide-white/10">
                {steps.map((step, index) => (
                  <li key={step.title} className="grid gap-4 py-6 sm:grid-cols-[4.5rem_1fr]">
                    <span className="text-display text-3xl text-white/40 tabular-nums">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3 className="text-display text-2xl">{step.title}</h3>
                      <p className="mt-2 max-w-md text-sm leading-relaxed text-white/65">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
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
              <ArrowUpRight weight="bold" className="size-4" aria-hidden="true" />
            </Link>
          </div>

          {highlights.length === 0 ? (
            <p className="mt-8 rounded-[28px] border border-dashed border-border p-10 text-center text-muted-foreground">
              Nothing is bookable for those dates. Try a different stay above.
            </p>
          ) : (
            <div className="mt-8 grid gap-5">
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
                <ArrowRight weight="bold" className="size-4" aria-hidden="true" />
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
                <ArrowUpRight weight="bold" className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <RoomStrip offers={rest} stayQuery={stayQuery} className="mt-8" />
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
