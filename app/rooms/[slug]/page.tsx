import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Bed,
  Buildings,
  CalendarCheck,
  Eye,
  Ruler,
  UsersThree,
} from '@phosphor-icons/react/dist/ssr';
import {
  ArrowLeftIcon,
  ArrowLeftStartOnRectangleIcon,
  ArrowRightEndOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { RoomNotFoundError } from '@/lib/application/catalog-service';
import { catalogService, DEMO_HOTEL_SLUG } from '@/lib/application/container';
import { buildQuery, parseAddOnIds, parseCriteria } from '@/lib/application/search-params';
import { bedLabels, formatFloor, viewLabels } from '@/lib/formatting';
import { pill, tag } from '@/lib/ui';
import { AssistantLauncher } from '@/components/assistant/assistant-launcher';
import { AddOnPicker } from '@/components/rooms/add-on-picker';
import { MobileBookBar } from '@/components/rooms/mobile-book-bar';
import { RoomPricing } from '@/components/rooms/room-pricing';
import { RoomSummary } from '@/components/rooms/room-summary';
import { amenityTone, factTone, featureIcon, tintInk, tintSurface } from '@/components/rooms/feature-icon';
import { RoomGallery } from '@/components/rooms/room-gallery';
import { ScrollArrows } from '@/components/rooms/room-strip-controls';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { cn } from '@/lib/utils';

export async function generateMetadata({ params }: PageProps<'/rooms/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug.replace(/-/g, ' ')} — Asteria Cove | SPARK StaySphere 360` };
}

export default async function RoomDetailPage({ params, searchParams }: PageProps<'/rooms/[slug]'>) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const criteria = parseCriteria(query);
  const addOnIds = parseAddOnIds(query);

  const detail = await catalogService
    .getRoomDetail(DEMO_HOTEL_SLUG, slug, criteria, addOnIds)
    .catch((error: unknown) => {
      if (error instanceof RoomNotFoundError) notFound();
      throw error;
    });

  const { offer, addOns, quote } = detail;
  const { room, ratePlan } = offer;
  const soldOut = offer.status === 'sold_out';
  const stayQuery = buildQuery({ criteria });
  const services = addOns.filter((addOn) => addOn.category === 'service');
  const dining = addOns.filter((addOn) => addOn.category === 'dining');
  const lateCheckOut = services.find((addOn) => addOn.id === 'addon_late' && addOn.enabled);

  const facts = [
    { icon: Ruler, label: `${room.areaM2} m²`, tone: factTone.area },
    { icon: Buildings, label: formatFloor(room.floor), tone: factTone.floor },
    { icon: UsersThree, label: `Sleeps up to ${room.capacity}`, tone: factTone.capacity },
    { icon: Bed, label: bedLabels[room.bedType], tone: factTone.bed },
    { icon: Eye, label: viewLabels[room.view], tone: factTone.view },
  ];

  return (
    <RoomPricing roomSlug={room.slug} criteria={criteria} quote={quote}>
      <SiteHeader stayQuery={stayQuery} />
      <main id="main" className="mx-auto max-w-[1400px] px-3 py-8 pb-28 sm:px-6 lg:py-12">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm">
          <Link href={`/rooms?${stayQuery}`} className={pill('secondary')}>
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            All rooms
          </Link>
        </nav>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-10">
          <div className="min-w-0">
            <header className="mb-5">
              <h1 className="text-display text-5xl sm:text-6xl">{room.name}</h1>
            </header>

            <RoomGallery room={room} />

            {/* Only the name stands above the photograph. The category and
                the hotel were a caption of the obvious; availability is
                stated in full, and more usefully, in the stay summary once
                the guest is deciding — not as a small badge up here. */}
            <div className="mt-6">
              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
                {room.description}
              </p>
              <ul className="mt-5 flex flex-wrap gap-1.5">
                {facts.map((fact) => (
                  <li key={fact.label} className={tag(tintSurface[fact.tone])}>
                    <fact.icon weight="fill" className={cn('size-3.5', tintInk[fact.tone])} aria-hidden="true" />
                    {fact.label}
                  </li>
                ))}
              </ul>
            </div>

            <section aria-labelledby="amenities-heading" className="mt-20">
              <div className="flex flex-wrap items-end gap-4">
                <h2 id="amenities-heading" className="text-display text-3xl">
                  In the room
                </h2>
                <ScrollArrows targetId="amenities-rail" className="ml-auto" />
              </div>
              {/* A card each, but deliberately not the tile grid the rules
                  warn about: a mark and the thing's name, nothing more. No
                  heading over two lines of copy, no icon in a tinted circle —
                  those are what made that pattern read as stock. White on the
                  same soft, tight shadow the room cards sit on; the tone is
                  carried by the mark alone, so the colour still says what
                  kind of thing it is without painting the whole card.
                  The same rail as the home page's rooms: four across from
                  `lg`, three from `sm`, two on a phone, sized from the rail
                  itself, and paged by the arrows beside the heading. */}
              <ul
                id="amenities-rail"
                className="no-scrollbar -mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto py-8"
              >
                {room.amenities.map((amenity) => {
                  const Icon = featureIcon(amenity);
                  const tone = amenityTone(amenity);
                  return (
                    <li
                      key={amenity}
                      className="flex min-h-32 w-[calc((100%-0.75rem)/2)] shrink-0 snap-start flex-col items-center justify-center gap-3 rounded-[28px] bg-card p-5 text-center shadow-soft sm:min-h-40 sm:w-[calc((100%-1.5rem)/3)] sm:gap-4 sm:p-6 lg:w-[calc((100%-2.25rem)/4)]"
                    >
                      <Icon
                        weight="fill"
                        className={cn('size-8 shrink-0 sm:size-9', tintInk[tone])}
                        aria-hidden="true"
                      />
                      <span className="text-base leading-snug font-medium text-foreground">
                        {amenity}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-labelledby="rate-heading" className="mt-20">
              <h2 id="rate-heading" className="text-display text-3xl">
                {ratePlan.name}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">Included at no extra cost.</p>

              {/* Chips, not a column of rows in a card. Four short phrases in
                  a full-width panel left it two-thirds empty and read as a
                  list of nothing in particular; at chip size they take one
                  line each and the marks carry the tone their subject already
                  wears on the amenity cards above. */}
              <ul className="mt-4 flex flex-wrap gap-2">
                {ratePlan.includedServices.map((service) => {
                  const Icon = featureIcon(service);
                  const tone = amenityTone(service);
                  return (
                    <li key={service} className={tag(cn(tintSurface[tone], 'px-3.5 py-2 text-sm'))}>
                      <Icon
                        weight="fill"
                        className={cn('size-4 shrink-0', tintInk[tone])}
                        aria-hidden="true"
                      />
                      {service}
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-labelledby="policies-heading" className="mt-20">
              <h2 id="policies-heading" className="text-display text-3xl">
                Check-in &amp; check-out
              </h2>
              {/* The hours a guest actually plans a flight or a taxi around,
                  stated as two facts rather than folded into the rate plan's
                  own copy — the same "arrow in, arrow out" pair the stay
                  summary uses, so arrival and departure read as the same
                  idea everywhere they appear. */}
              <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
                <div className={cn('rounded-[20px] p-4', tintSurface.stone)}>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ArrowRightEndOnRectangleIcon className="size-4 shrink-0" aria-hidden="true" />
                    Check-in
                  </p>
                  <p className="text-display mt-1 text-xl">From 3:00 PM</p>
                </div>
                <div className={cn('rounded-[20px] p-4', tintSurface.stone)}>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ArrowLeftStartOnRectangleIcon className="size-4 shrink-0" aria-hidden="true" />
                    Check-out
                  </p>
                  <p className="text-display mt-1 text-xl">By 11:00 AM</p>
                </div>
              </div>
              {/* Only a promise the booking engine can keep: withdrawing the
                  add-on in admin should not leave a line on the page still
                  offering it. */}
              {lateCheckOut ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Leaving later? Add a late check-out below to hold the room until 6:00 PM.
                </p>
              ) : null}

              {/* Cancellation is the other half of what the rate is worth, so
                  it gets the same treatment the demo-payment notice does: a
                  soft tint it can't be scrolled past without noticing, in the
                  success green this icon already carries elsewhere on the
                  page — not the accent, which rule 6 keeps for savings and
                  the primary action. A second sentence spells out what the
                  policy actually buys the guest, since "free cancellation"
                  alone reads as marketing until it says free of what. */}
              <div className="mt-5 flex items-start gap-3 rounded-3xl bg-success/10 p-4 text-base">
                <CalendarCheck
                  weight="fill"
                  className="mt-0.5 size-5 shrink-0 text-success"
                  aria-hidden="true"
                />
                <p>
                  <span className="font-medium">{ratePlan.cancellationPolicy}</span> Cancel or
                  change your dates any time before then and nothing is charged — no fee, no form
                  to fill in beyond this page.
                </p>
              </div>
            </section>

            <section aria-labelledby="addons-heading" className="mt-20">
              <h2 id="addons-heading" className="text-display text-3xl">
                Add services
              </h2>
              <p className="mt-2 mb-5 text-sm text-muted-foreground">
                Priced by the booking engine and added to your total immediately.
              </p>
              <AddOnPicker addOns={services} />
            </section>

            {/* The kitchen sells through the same engine, but it is a different decision. */}
            {dining.some((addOn) => addOn.enabled && !addOn.parentId) ? (
              <section aria-labelledby="dining-heading" className="mt-20">
                <h2 id="dining-heading" className="text-display text-3xl">
                  Order from the kitchen
                </h2>
                <p className="mt-2 mb-5 text-sm text-muted-foreground">
                  Food and drink arranged before you arrive and charged with the stay, so nothing is
                  settled at the table.
                </p>
                <AddOnPicker addOns={dining} />
              </section>
            ) : null}
          </div>

          <RoomSummary
            roomSlug={room.slug}
            criteria={criteria}
            roomsHref={`/rooms?${stayQuery}`}
            soldOut={soldOut}
          />
        </div>
      </main>
      <MobileBookBar roomSlug={room.slug} criteria={criteria} roomsHref={`/rooms?${stayQuery}`} />
      <SiteFooter stayQuery={stayQuery} clearsFloatingBar />
      <AssistantLauncher mobileOffset="above-book-bar" />
    </RoomPricing>
  );
}
