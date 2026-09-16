import type { Metadata } from 'next';
import { catalogService, DEMO_HOTEL_SLUG, inventoryService } from '@/lib/application/container';
import {
  buildQuery,
  parseCriteria,
  parseFilters,
  parseLayout,
  parseRoomNumber,
  toIsoDate,
} from '@/lib/application/search-params';
import { RoomsView } from '@/components/rooms/rooms-view';

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
  const plan =
    layout === 'plan' ? await inventoryService.getFloorPlan(DEMO_HOTEL_SLUG, criteria, filters) : null;
  const { offers, facets } = result;

  const stayQuery = buildQuery({ criteria, filters, layout });
  const nights = offers[0]?.price.nights ?? 1;

  return (
    <RoomsView
      criteria={criteria}
      filters={filters}
      layout={layout}
      today={today}
      offers={offers}
      facets={facets}
      plan={plan}
      stayQuery={stayQuery}
      nights={nights}
      initialRoom={parseRoomNumber(params)}
    />
  );
}
