import type { Metadata } from 'next';
import Link from 'next/link';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { defaultRoomFilters } from '@/lib/application/catalog-service';
import { catalogService, DEMO_HOTEL_SLUG } from '@/lib/application/container';
import {
  activeFilterCount,
  buildQuery,
  parseCriteria,
  parseFilters,
  parseLayout,
  toIsoDate,
  type CatalogLayout,
} from '@/lib/application/search-params';
import { formatDateRange, formatGuests, formatNights } from '@/lib/formatting';
import { pill } from '@/lib/ui';
import { LayoutToggle } from '@/components/rooms/layout-toggle';
import { RoomCard } from '@/components/rooms/room-card';
import { RoomFiltersPanel } from '@/components/rooms/room-filters';
import { SortSelect } from '@/components/rooms/sort-select';
import { StaySearchBar } from '@/components/search/stay-search-bar';
import { SectionLabel } from '@/components/site/section-label';
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
  const layout = parseLayout(params);
  const today = toIsoDate(new Date());

  const result = await catalogService.search(DEMO_HOTEL_SLUG, criteria, filters);
  const { offers, totalRooms, facets } = result;

  const stayQuery = buildQuery({ criteria, filters, layout });
  const filterCount = activeFilterCount(filters);
  const nights = offers[0]?.price.nights ?? 1;

  return (
    <>
      <SiteHeader
        stayQuery={stayQuery}
        search={
          <StaySearchBar
            criteria={criteria}
            filters={filters}
            minDate={today}
            submitLabel="Update stay"
            size="compact"
          />
        }
      />
      <main id="main" className="mx-auto max-w-[1400px] px-3 py-8 sm:px-6 lg:py-12">
        <header className="max-w-2xl">
          <SectionLabel>
            {formatDateRange(criteria.checkIn, criteria.checkOut)} · {formatNights(nights)} ·{' '}
            {formatGuests(criteria.adults, criteria.children)}
          </SectionLabel>
          <h1 className="text-display mt-4 text-5xl sm:text-6xl">Choose your room</h1>
        </header>

        {/* From `lg` the same search rides in the header instead. */}
        <div className="mt-8 lg:hidden">
          <h2 className="sr-only">Change your stay</h2>
          <StaySearchBar criteria={criteria} filters={filters} minDate={today} submitLabel="Update stay" />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:gap-8">
          <RoomFiltersPanel
            criteria={criteria}
            filters={filters}
            facets={facets}
            resultCount={offers.length}
            layout={layout}
          />

          <section aria-label="Search results">
            {/* The count and the two controls do not fit one line on a phone —
                together they were wider than the column and pushed the results
                past the page's own gutter. Below `sm` they stack. */}
            <div className="flex flex-col gap-3 pb-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <p role="status" className="text-sm">
                <span className="font-medium">
                  {offers.length} of {totalRooms} room types
                </span>
                <span className="text-muted-foreground">
                  {filterCount > 0 ? ` match ${filterCount} ${filterCount === 1 ? 'filter' : 'filters'}` : ' fit your stay'}
                </span>
              </p>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <LayoutToggle criteria={criteria} filters={filters} layout={layout} />
                <SortSelect criteria={criteria} filters={filters} layout={layout} />
              </div>
            </div>

            {offers.length === 0 ? (
              <EmptyResults criteria={criteria} layout={layout} />
            ) : (
              <div
                className={
                  layout === 'list'
                    ? 'grid gap-4'
                    : 'grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4'
                }
              >
                {offers.map((offer) => (
                  <RoomCard
                    key={offer.room.id}
                    offer={offer}
                    stayQuery={stayQuery}
                    layout={layout === 'list' ? 'row' : 'tile'}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
      <SiteFooter stayQuery={stayQuery} />
    </>
  );
}

function EmptyResults({
  criteria,
  layout,
}: {
  criteria: ReturnType<typeof parseCriteria>;
  layout: CatalogLayout;
}) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-[28px] border border-dashed border-border bg-card p-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-stone text-muted-foreground">
        <MagnifyingGlassIcon className="size-5" aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-display text-3xl">No rooms match those filters</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Your dates and party size are still applied. Clearing the filters will show every room
          type that sleeps {criteria.adults + criteria.children}.
        </p>
      </div>
      <Link href={`/rooms?${buildQuery({ criteria, filters: defaultRoomFilters, layout })}`} className={pill('primary')}>
        Reset filters
      </Link>
    </div>
  );
}
