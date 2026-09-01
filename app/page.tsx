import Link from 'next/link';
import { ArrowRight, Building2, ShieldCheck, Sparkles, Waves } from 'lucide-react';
import { catalogService, DEMO_HOTEL_SLUG } from '@/lib/application/container';
import { buildQuery, parseCriteria, toIsoDate } from '@/lib/application/search-params';
import { formatMoney } from '@/lib/formatting';
import { HotelScene } from '@/components/hotel/hotel-scene';
import { RoomCard } from '@/components/rooms/room-card';
import { StaySearchBar } from '@/components/search/stay-search-bar';
import { Eyebrow } from '@/components/site/eyebrow';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { defaultRoomFilters } from '@/lib/application/catalog-service';

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

  return (
    <>
      <SiteHeader stayQuery={stayQuery} />
      <main id="main">
        <section className="mx-auto max-w-[1400px] px-4 pt-10 pb-6 sm:px-6 lg:px-10 lg:pt-16">
          <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <div>
              <Eyebrow>
                {hotel.location} · {totalRooms} room types
              </Eyebrow>
              <h1 className="text-display mt-4 text-[clamp(2.75rem,8vw,5.5rem)]">{hotel.name}</h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
                A cliffside house of {totalRooms} room types above a working fishing cove. Look
                around the property, open the exact room you want, and book it direct.
              </p>
              <p className="text-display mt-3 text-xl text-cyan-dark">{hotel.tagline}</p>
            </div>
            <dl className="grid grid-cols-3 gap-2 sm:gap-4 lg:grid-cols-1 lg:gap-3">
              <Stat label="Available now" value={`${availableRooms} of ${totalRooms}`} />
              <Stat
                label="From"
                value={`${formatMoney(facets.priceRange.min, hotel.currency)}/night`}
              />
              <Stat label="Direct booking" value="Best rate" />
            </dl>
          </div>

          <HotelScene
            stayQuery={stayQuery}
            className="mt-8 aspect-[4/3] sm:aspect-[16/9] lg:aspect-[2/1]"
          />

          <div className="mt-6">
            <h2 className="sr-only">Search rooms</h2>
            <StaySearchBar criteria={criteria} minDate={today} />
          </div>
        </section>

        <section className="mx-auto max-w-[1400px] px-4 py-12 sm:px-6 lg:px-10">
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: Waves,
                title: 'See the actual room',
                body: 'Every room type has its own view, floor, and terrace drawn to scale — no stock photography standing in for a room you did not book.',
              },
              {
                icon: ShieldCheck,
                title: 'Book direct, pay less',
                body: 'Direct rates include breakfast and the beach club, and are compared against a demo partner-site price on every card.',
              },
              {
                icon: Building2,
                title: 'One connected journey',
                body: 'Search, inspect, add services, and confirm in one flow. Prices are rechecked server-side right before you confirm.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-3xl border border-border bg-card p-6 shadow-soft">
                <span className="grid size-10 place-items-center rounded-2xl bg-cyan/15 text-cyan-dark">
                  <item.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1400px] px-4 pb-4 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>Recommended for your dates</Eyebrow>
              <h2 className="text-display mt-2 text-3xl sm:text-4xl">Where to stay</h2>
            </div>
            <Link
              href={`/rooms?${stayQuery}`}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:bg-canvas"
            >
              All {totalRooms} room types
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>

          {highlights.length === 0 ? (
            <p className="mt-8 rounded-3xl border border-dashed border-border p-8 text-center text-muted-foreground">
              Nothing is bookable for those dates. Try a different stay above.
            </p>
          ) : (
            <div className="mt-8 grid gap-6">
              {highlights.map((offer) => (
                <RoomCard key={offer.room.id} offer={offer} stayQuery={stayQuery} />
              ))}
            </div>
          )}
        </section>

        <section className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 lg:px-10">
          <div className="flex flex-col items-start gap-6 rounded-3xl bg-ink p-8 text-[#F2F1EC] sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div>
              <p className="eyebrow flex items-center gap-2 text-cyan">
                <Sparkles className="size-4" aria-hidden="true" />
                Demo booking
              </p>
              <h2 className="text-display mt-3 max-w-lg text-3xl sm:text-4xl">
                Take the whole journey, end to end.
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-[#A4ABAC]">
                Search, inspect a room, add services, and confirm. Payment is simulated and clearly
                labelled — no card details are ever collected.
              </p>
            </div>
            <Link
              href={`/rooms?${stayQuery}`}
              className="flex min-h-11 shrink-0 items-center gap-2 rounded-2xl bg-cyan px-6 text-sm font-semibold text-ink hover:bg-cyan/85"
            >
              Explore rooms
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-3 py-2.5 sm:px-4 sm:py-3">
      <dt className="eyebrow text-[10px] text-muted-foreground sm:text-[11px]">{label}</dt>
      <dd className="mt-1 text-base font-semibold sm:text-lg">{value}</dd>
    </div>
  );
}
