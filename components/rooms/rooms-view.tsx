'use client';

import Link from 'next/link';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { defaultRoomFilters, type CatalogFacets, type RoomFilters } from '@/lib/application/catalog-service';
import { buildQuery, type CatalogLayout } from '@/lib/application/search-params';
import type { RoomOffer, StayCriteria } from '@/lib/domain/schemas';
import type { FloorPlan as FloorPlanResult } from '@/lib/application/inventory-service';
import { lDateRange, lGuests, lNights } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { useLocale, useT } from '@/lib/i18n/context';
import { AssistantLauncher } from '@/components/assistant/assistant-launcher';
import { FloorPlan } from '@/components/rooms/floor-plan/floor-plan';
import { LayoutToggle } from '@/components/rooms/layout-toggle';
import { RoomCard } from '@/components/rooms/room-card';
import { RoomFiltersPanel } from '@/components/rooms/room-filters';
import { SortSelect } from '@/components/rooms/sort-select';
import { StaySearchBar } from '@/components/search/stay-search-bar';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';

interface RoomsViewProps {
  criteria: StayCriteria;
  filters: RoomFilters;
  layout: CatalogLayout;
  today: string;
  offers: RoomOffer[];
  facets: CatalogFacets;
  plan: FloorPlanResult | null;
  stayQuery: string;
  nights: number;
  initialRoom: string | null;
}

export function RoomsView({
  criteria,
  filters,
  layout,
  today,
  offers,
  facets,
  plan,
  stayQuery,
  nights,
  initialRoom,
}: RoomsViewProps) {
  const { locale } = useLocale();
  const t = useT();
  const dateRange = lDateRange(criteria.checkIn, criteria.checkOut, locale);

  return (
    <>
      <SiteHeader
        stayQuery={stayQuery}
        search={
          <StaySearchBar
            criteria={criteria}
            filters={filters}
            minDate={today}
            submitLabel={t('search.updateStay')}
            size="compact"
          />
        }
      />
      <main id="main" className="container-page py-8 lg:py-12">
        <header className="max-w-2xl">
          <h1 className="text-display text-5xl sm:text-6xl">{t('rooms.chooseYourRoom')}</h1>
          <p className="mt-3 text-base text-muted-foreground">
            {t('rooms.subtitle', {
              dateRange,
              nights: lNights(nights, locale),
              guests: lGuests(criteria.adults, criteria.children, locale),
            })}
          </p>
        </header>

        {/* From `lg` the same search rides in the header instead. */}
        <div className="mt-8 lg:hidden">
          <h2 className="sr-only">{t('search.changeYourStay')}</h2>
          <StaySearchBar criteria={criteria} filters={filters} minDate={today} submitLabel={t('search.updateStay')} />
        </div>

        <div className="mt-8 grid gap-y-6 gap-x-gutter lg:grid-cols-sidebar-start">
          <RoomFiltersPanel
            criteria={criteria}
            filters={filters}
            facets={facets}
            resultCount={offers.length}
            layout={layout}
          />

          <section aria-label="Search results">
            <div className="flex flex-wrap items-center justify-end gap-2 pb-5">
              {plan ? (
                <p className="mr-auto text-sm text-muted-foreground">
                  {t(plan.availableCount === 1 ? 'rooms.availableForDatesOne' : 'rooms.availableForDatesOther', {
                    available: String(plan.availableCount),
                    total: String(plan.units.length),
                    dateRange,
                  })}
                </p>
              ) : null}
              <LayoutToggle criteria={criteria} filters={filters} layout={layout} />
              {plan ? null : <SortSelect criteria={criteria} filters={filters} layout={layout} />}
            </div>

            {plan ? (
              <FloorPlan units={plan.units} floors={plan.floors} criteria={criteria} initialRoom={initialRoom} />
            ) : offers.length === 0 ? (
              <EmptyResults criteria={criteria} layout={layout} />
            ) : (
              <div
                className={
                  layout === 'list' ? 'grid gap-4' : 'grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4'
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
      <AssistantLauncher />
    </>
  );
}

function EmptyResults({ criteria, layout }: { criteria: StayCriteria; layout: CatalogLayout }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-5 rounded-[18px] border border-dashed border-border bg-card p-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-stone text-muted-foreground">
        <MagnifyingGlassIcon className="size-5" aria-hidden="true" />
      </span>
      <div>
        <h2 className="text-display text-2xl sm:text-3xl">{t('rooms.noRoomsMatch')}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {t('rooms.noRoomsMatchBody', { party: String(criteria.adults + criteria.children) })}
        </p>
      </div>
      <Link href={`/rooms?${buildQuery({ criteria, filters: defaultRoomFilters, layout })}`} className={pill('primary')}>
        {t('rooms.resetFilters')}
      </Link>
    </div>
  );
}
