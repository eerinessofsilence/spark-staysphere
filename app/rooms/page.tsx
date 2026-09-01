import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { defaultRoomFilters } from '@/lib/application/catalog-service';
import { catalogService, DEMO_HOTEL_SLUG } from '@/lib/application/container';
import {
  activeFilterCount,
  buildQuery,
  parseCriteria,
  parseFilters,
  toIsoDate,
} from '@/lib/application/search-params';
import { formatDateRange, formatGuests, formatNights } from '@/lib/formatting';
import { RoomCard } from '@/components/rooms/room-card';
import { RoomFiltersPanel } from '@/components/rooms/room-filters';
import { SortSelect } from '@/components/rooms/sort-select';
import { StaySearchBar } from '@/components/search/stay-search-bar';
import { Eyebrow } from '@/components/site/eyebrow';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';

export const metadata: Metadata = {
  title: 'Rooms — Asteria Cove | SPARK StaySphere 360',
  description: 'Search Asteria Cove rooms by dates, guests, view, floor, and amenities.',
};

export default async function RoomsPage({ searchParams }: PageProps<'/rooms'>) {
  const params = await searchParams;
  const criteria = parseCriteria(params);
  const filters = parseFilters(params);
  const today = toIsoDate(new Date());

  const result = await catalogService.search(DEMO_HOTEL_SLUG, criteria, filters);
  const { hotel, offers, totalRooms, facets } = result;

  const stayQuery = buildQuery({ criteria, filters });
  const filterCount = activeFilterCount(filters);
  const nights = offers[0]?.price.nights ?? 1;

  return (
    <>
      <SiteHeader stayQuery={stayQuery} />
      <main id="main" className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
          <Link href={`/?${buildQuery({ criteria })}`} className="hover:text-foreground">
            {hotel.name}
          </Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page" className="text-foreground">
            Rooms
          </span>
        </nav>

        <header className="max-w-2xl">
          <Eyebrow>{hotel.location}</Eyebrow>
          <h1 className="text-display mt-3 text-4xl sm:text-5xl">Choose your room</h1>
          <p className="mt-3 text-muted-foreground">
            {formatDateRange(criteria.checkIn, criteria.checkOut)} · {formatNights(nights)} ·{' '}
            {formatGuests(criteria.adults, criteria.children)}
          </p>
        </header>

        <div className="mt-6">
          <h2 className="sr-only">Change your stay</h2>
          <StaySearchBar
            criteria={criteria}
            filters={filters}
            minDate={today}
            variant="inline"
            submitLabel="Update stay"
          />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,17.5rem)_minmax(0,1fr)] lg:gap-8">
          <RoomFiltersPanel
            criteria={criteria}
            filters={filters}
            facets={facets}
            resultCount={offers.length}
          />

          <section aria-label="Search results">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
              <p role="status" className="text-sm">
                <span className="font-semibold">
                  {offers.length} of {totalRooms} room types
                </span>
                <span className="text-muted-foreground">
                  {filterCount > 0
                    ? ` match ${filterCount} ${filterCount === 1 ? 'filter' : 'filters'}`
                    : ' fit your stay'}
                </span>
              </p>
              <SortSelect criteria={criteria} filters={filters} />
            </div>

            {offers.length === 0 ? (
              <EmptyResults criteria={criteria} />
            ) : (
              <div className="grid gap-6">
                {offers.map((offer) => (
                  <RoomCard key={offer.room.id} offer={offer} stayQuery={stayQuery} />
                ))}
              </div>
            )}

            <p className="mt-8 rounded-2xl border border-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
              Availability, rates, and partner-site comparison prices shown here are simulated demo
              data held in memory. Nothing on this page reserves a room at a real property.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function EmptyResults({ criteria }: { criteria: ReturnType<typeof parseCriteria> }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-border bg-card p-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-canvas text-muted-foreground">
        <SearchX className="size-6" aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-display text-2xl">No rooms match those filters</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Your dates and party size are still applied. Clearing the filters will show every room
          type that sleeps {criteria.adults + criteria.children}.
        </p>
      </div>
      <Link
        href={`/rooms?${buildQuery({ criteria, filters: defaultRoomFilters })}`}
        className="flex min-h-11 items-center rounded-xl bg-cyan px-5 text-sm font-semibold text-ink hover:bg-cyan/85"
      >
        Reset filters
      </Link>
    </div>
  );
}
