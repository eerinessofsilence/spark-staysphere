import Link from 'next/link';
import { ArrowRightIcon, ArrowUpRightIcon } from '@heroicons/react/24/outline';
import { defaultRoomFilters } from '@/lib/application/catalog-service';
import { coverPhoto } from '@/lib/domain/room-attributes';
import { catalogService, DEMO_HOTEL_SLUG } from '@/lib/application/container';
import { buildQuery, parseCriteria, toIsoDate } from '@/lib/application/search-params';
import { pill } from '@/lib/ui';
import { HotelScene } from '@/components/hotel/hotel-scene';
import { RoomCard } from '@/components/rooms/room-card';
import { RoomStrip } from '@/components/rooms/room-strip';
import { RoomStripControls, ScrollArrows } from '@/components/rooms/room-strip-controls';
import { StaySearchBar } from '@/components/search/stay-search-bar';
import { ParallaxImage } from '@/components/site/parallax-image';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';

export default async function HomePage({ searchParams }: PageProps<'/'>) {
  const params = await searchParams;
  const criteria = parseCriteria(params);
  const stayQuery = buildQuery({ criteria });
  const today = toIsoDate(new Date());

  const { hotel, offers } = await catalogService.search(
    DEMO_HOTEL_SLUG,
    criteria,
    defaultRoomFilters,
  );
  // Eight: two screens of four, so the arrows have one page to reveal and
  // the rail stays a selection rather than the whole catalog. Whatever is
  // left goes to the rail on the way out.
  const highlights = offers.slice(0, 8);
  const rest = offers.slice(8);

  // Deep link into the building spinner: `?frame=N` turns it directly;
  // `?unit=<roomSlug or hotspot id>` turns it to wherever that hotspot is visible.
  const frameParam = typeof params.frame === 'string' ? Number.parseInt(params.frame, 10) : NaN;
  const spinnerInitialFrame = Number.isFinite(frameParam) ? frameParam : undefined;
  const unitParam = typeof params.unit === 'string' ? params.unit : undefined;
  const spinnerFocusHotspotId = unitParam
    ? (hotel.spinner?.hotspots.find((hotspot) => hotspot.roomSlug === unitParam || hotspot.id === unitParam)
        ?.id ?? null)
    : null;

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
        status: offer.status,
        remaining: offer.remaining,
        nightlyPrice: offer.price.nightlyPrice,
        currency: offer.price.currency,
        photo: coverPhoto(offer.room),
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
        <section className="mx-auto max-w-[1400px] pt-3 sm:px-6 sm:pt-8 lg:pt-14">
          <h1 className="sr-only">{hotel.name}</h1>

          {/* On a phone the arrival photograph is the screen: it runs to both
              edges and starts straight under the header, rather than sitting
              in the page's gutter as one more card. The inset card returns at
              `sm`, where the canvas around it is composition, not waste. */}
          <HotelScene
            areas={hotel.areas}
            location={hotel.location}
            stayQuery={stayQuery}
            rooms={roomFacts}
            spinner={hotel.spinner}
            spinnerInitialFrame={spinnerInitialFrame}
            spinnerFocusHotspotId={spinnerFocusHotspotId}
          />

          {/* Its own gutter now: the section gave up its padding so the
              photograph above could reach the edges. */}
          <div className="mt-5 px-3 sm:px-6 lg:px-12">
            <h2 className="sr-only">Search rooms</h2>
            {/* From `lg` the same search rides in the header instead. */}
            <div className="lg:hidden">
              <StaySearchBar criteria={criteria} minDate={today} />
            </div>
          </div>
        </section>

        {/* Recommended rooms */}
        <section aria-labelledby="rooms-heading" className="mx-auto mt-20 max-w-[1400px] px-3 sm:px-6">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <h2 id="rooms-heading" className="text-display text-4xl sm:text-5xl">
                Where to stay
              </h2>
            </div>
            {/* `ml-auto` on the row: a wrap on a narrow screen puts this on
                its own line, where `justify-between` on the row itself would
                align a lone item to the start instead of the end. Within the
                pair, though, a full-width `justify-between` once it has that
                line to itself — the pill left, arrows right — rather than
                both huddled at one edge with the rest of the line empty. */}
            <div className="ml-auto flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
              <Link href={`/rooms?${stayQuery}`} className={pill('secondary')}>
                View all
                <ArrowUpRightIcon className="size-4" aria-hidden="true" />
              </Link>
              <ScrollArrows targetId="highlights-rail" />
            </div>
          </div>

          {highlights.length === 0 ? (
            <p className="mt-8 rounded-[28px] border border-dashed border-border p-10 text-center text-muted-foreground">
              Nothing is bookable for those dates. Try a different stay above.
            </p>
          ) : (
            <>
              {/* A rail, not a grid: fixed-width tiles so the row scrolls
                  sideways instead of wrapping, with the arrows above paging
                  it by one tile. The bleed past the section's own padding
                  matches "The other rooms" rail below. */}
              <ul
                id="highlights-rail"
                className="no-scrollbar -mx-3 mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 sm:-mx-6 sm:px-6 lg:gap-[42px]"
              >
                {/* Sized from the rail, not in px: exactly four across from
                    `lg`, three from `sm`, two on a phone — the width is the
                    section's, minus the gaps between the tiles it holds. */}
                {highlights.map((offer) => (
                  <li
                    key={offer.room.id}
                    className="w-[calc((100%-0.75rem)/2)] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/3)] lg:w-[calc((100%-126px)/4)]"
                  >
                    <RoomCard offer={offer} stayQuery={stayQuery} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Closing band */}
        <section className="mx-auto mt-20 max-w-[1400px] px-3 sm:px-6">
          {/* Ink under the photograph, not just behind it: the copy on
              this band is white, and the photo is lazy-loaded, so by day
              an unloaded frame would leave white text on a pale page. */}
          <div className="relative overflow-hidden rounded-[28px] bg-ink">
            <ParallaxImage src="/images/hotel/pool.webp" alt="" width={2000} height={1334} />
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
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <h2 id="rest-heading" className="text-display text-4xl sm:text-5xl">
                  The other rooms
                </h2>
              </div>
              <RoomStripControls
                targetId="other-rooms-rail"
                href={`/rooms?${stayQuery}`}
                className="ml-auto"
              />
            </div>
            <RoomStrip id="other-rooms-rail" offers={rest} stayQuery={stayQuery} className="mt-8" />
          </section>
        ) : null}
      </main>
      <SiteFooter stayQuery={stayQuery} />
    </>
  );
}
