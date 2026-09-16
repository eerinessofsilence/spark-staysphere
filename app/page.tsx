import { defaultRoomFilters } from '@/lib/application/catalog-service';
import { coverPhoto } from '@/lib/domain/room-attributes';
import { catalogService, DEMO_HOTEL_SLUG } from '@/lib/application/container';
import { buildQuery, parseCriteria, toIsoDate } from '@/lib/application/search-params';
import { HomeView } from '@/components/home/home-view';

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
    <HomeView
      hotel={hotel}
      stayQuery={stayQuery}
      today={today}
      criteria={criteria}
      highlights={highlights}
      rest={rest}
      roomFacts={roomFacts}
      spinner={hotel.spinner}
      spinnerInitialFrame={spinnerInitialFrame}
      spinnerFocusHotspotId={spinnerFocusHotspotId}
    />
  );
}
