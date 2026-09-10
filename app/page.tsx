import Link from 'next/link';
import { ArrowRightIcon, ArrowUpRightIcon, MapPinIcon } from '@heroicons/react/24/outline';
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
import { Reveal } from '@/components/site/reveal';
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

        {/* About the hotel. The interactive scene above is where a guest
            explores; this is the one paragraph that says what the place
            actually is, for the guest who wants that before anything else. */}
        <section aria-labelledby="about-heading" className="mx-auto mt-20 max-w-[1400px] px-3 sm:px-6">
          {/* No card, no shadow: this reads as the page's own copy, not one
              more tile among the room cards. Half the band each — at a third
              of the width the photograph was a thumbnail sat beside display
              type, too small to be the view it is meant to sell. */}
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-16">
            <Reveal>
              <h2 id="about-heading" className="text-display text-4xl sm:text-5xl">
                About {hotel.name}
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                Eight floors of white balconies curving above the town, the upper ones looking
                clear over the rooftops to the Mediterranean, with a 25-metre infinity pool and a
                cliffside spa on site, and the bay's marina and beach clubs ten minutes downhill.
              </p>
              <p className="mt-5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPinIcon className="size-4 shrink-0" aria-hidden="true" />
                {hotel.location}
              </p>
            </Reveal>
            <Reveal delay={120} className="relative aspect-square overflow-hidden rounded-[28px]">
              <img
                src="/images/hotel/cove.webp"
                alt="The cove below Asteria Cove, with the beach club and the boat to the islands"
                width={2000}
                height={3000}
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
              />
            </Reveal>
          </div>
        </section>

        {/* Recommended rooms */}
        <section aria-labelledby="rooms-heading" className="mx-auto mt-20 max-w-[1400px] px-3 sm:px-6">
          <div className="flex flex-wrap items-end gap-4">
            <Reveal>
              <h2 id="rooms-heading" className="text-display text-4xl sm:text-5xl">
                Where to stay
              </h2>
            </Reveal>
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
                className="no-scrollbar -mx-3 mt-8 flex snap-x snap-mandatory gap-5 overflow-x-auto px-3 pb-2 scroll-pl-3 sm:-mx-6 sm:px-6 sm:scroll-pl-6"
              >
                {/* Sized from the rail, not in px: exactly four across from
                    `lg`, three from `sm`, two on a phone — the width is the
                    section's, minus the gaps between the tiles it holds. One
                    gap size throughout (20px) rather than a wider one at
                    `lg`, so the spacing itself never changes, only the count. */}
                {highlights.map((offer) => (
                  <li
                    key={offer.room.id}
                    className="w-[calc((100%-1.25rem)/2)] shrink-0 snap-start sm:w-[calc((100%-2.5rem)/3)] lg:w-[calc((100%-3.75rem)/4)]"
                  >
                    <RoomCard offer={offer} stayQuery={stayQuery} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Closing band */}
        <section aria-labelledby="closing-heading" className="mx-auto mt-20 max-w-[1400px] px-3 sm:px-6">
          {/* Ink under the photograph, not just behind it: the copy here is
              white and the photo is lazy-loaded, so an unloaded frame would
              otherwise leave white text on a pale page. */}
          <div className="relative overflow-hidden rounded-[28px] bg-ink">
            <ParallaxImage src="/images/hotel/pool.webp" alt="" width={2000} height={1334} />
            {/* Two scrims rather than one flat wash across the middle. The
                copy sits bottom-left, so the photograph is darkened hardest
                exactly there and left alone where nothing is written — the
                single left-to-right gradient dimmed the whole picture and
                still left the body copy sitting on open water. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/15 to-transparent"
            />
            <div className="relative flex flex-col items-start gap-7 p-8 pt-40 text-[#F7F5F0] sm:p-12 sm:pt-56 lg:min-h-[32rem] lg:justify-end">
              <Reveal>
                {/* The section's actual heading, not a paragraph that looks
                    like one. The emphasis is carried by the italic serif
                    alone: the accent token behind it is clay by day, and a
                    dark clay on a dark photograph read as mud. */}
                <h2
                  id="closing-heading"
                  className="text-display max-w-2xl text-5xl leading-[1.05] sm:text-6xl lg:text-7xl"
                >
                  Take the whole journey,{' '}
                  <span className="text-accent-italic sm:whitespace-nowrap">end to end.</span>
                </h2>
              </Reveal>
              <p className="max-w-md text-[15px] leading-relaxed text-white/85">
                Search, inspect a room, add services, and confirm. Payment is simulated and clearly
                labelled — no card details are ever collected.
              </p>
              <Link href={`/rooms?${stayQuery}`} className={pill('onPhoto', 'min-h-12 px-6')}>
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
              <Reveal>
                <h2 id="rest-heading" className="text-display text-4xl sm:text-5xl">
                  The other rooms
                </h2>
              </Reveal>
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
