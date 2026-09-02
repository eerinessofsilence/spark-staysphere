import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Bed, Buildings, Check, Eye, Ruler, UsersThree } from '@phosphor-icons/react/dist/ssr';
import { RoomNotFoundError } from '@/lib/application/catalog-service';
import { catalogService, DEMO_HOTEL_SLUG } from '@/lib/application/container';
import { buildQuery, parseAddOnIds, parseCriteria } from '@/lib/application/search-params';
import { roomCategory } from '@/lib/domain/room-attributes';
import {
  bedLabels,
  categoryLabels,
  formatDateRange,
  formatFloor,
  formatGuests,
  formatMoney,
  formatNights,
  viewLabels,
} from '@/lib/formatting';
import { pill, tag } from '@/lib/ui';
import { AddOnPicker, QuoteLines } from '@/components/rooms/add-on-picker';
import { MobileBookBar } from '@/components/rooms/mobile-book-bar';
import { RoomGallery } from '@/components/rooms/room-gallery';
import { StatusBadge } from '@/components/rooms/status-badge';
import { SectionLabel } from '@/components/site/section-label';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';

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

  const { hotel, offer, addOns, quote } = detail;
  const { room, ratePlan } = offer;
  const soldOut = offer.status === 'sold_out';
  const stayQuery = buildQuery({ criteria });
  const bookQuery = buildQuery({ criteria, addOnIds: quote.addOnIds });

  const facts = [
    { icon: Ruler, label: `${room.areaM2} m²` },
    { icon: Buildings, label: formatFloor(room.floor) },
    { icon: UsersThree, label: `Sleeps up to ${room.capacity}` },
    { icon: Bed, label: bedLabels[room.bedType] },
    { icon: Eye, label: viewLabels[room.view] },
  ];

  return (
    <>
      <SiteHeader stayQuery={stayQuery} />
      <main id="main" className="mx-auto max-w-[1400px] px-3 py-8 pb-28 sm:px-6 lg:py-12">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm">
          <Link href={`/rooms?${stayQuery}`} className="inline-flex min-h-11 items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft weight="bold" className="size-4" aria-hidden="true" />
            All rooms
          </Link>
        </nav>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-10">
          <div className="min-w-0">
            <header className="mb-6">
              <div className="flex flex-wrap items-center gap-3">
                <SectionLabel>
                  {categoryLabels[roomCategory(room)]} · {hotel.name}
                </SectionLabel>
                <StatusBadge status={offer.status} remaining={offer.remaining} />
              </div>
              <h1 className="text-display mt-4 text-5xl sm:text-6xl">{room.name}</h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{room.description}</p>
              <ul className="mt-5 flex flex-wrap gap-1.5">
                {facts.map((fact) => (
                  <li key={fact.label} className={tag()}>
                    <fact.icon weight="fill" className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    {fact.label}
                  </li>
                ))}
              </ul>
            </header>

            <RoomGallery room={room} />

            <section aria-labelledby="amenities-heading" className="mt-12">
              <h2 id="amenities-heading" className="text-display text-3xl">
                In the room
              </h2>
              <ul className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {room.amenities.map((amenity) => (
                  <li key={amenity} className="flex items-center gap-2 text-sm">
                    <Check weight="bold" className="size-4 shrink-0 text-success" aria-hidden="true" />
                    {amenity}
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="rate-heading" className="mt-12">
              <h2 id="rate-heading" className="text-display text-3xl">
                {ratePlan.name}
              </h2>
              <div className="mt-5 rounded-[28px] bg-card p-6 shadow-soft">
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {ratePlan.includedServices.map((service) => (
                    <li key={service} className="flex items-start gap-2 text-sm">
                      <Check weight="bold" className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                      {service}
                    </li>
                  ))}
                </ul>
                <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">{ratePlan.cancellationPolicy}</p>
              </div>
            </section>

            <section aria-labelledby="addons-heading" className="mt-12">
              <h2 id="addons-heading" className="text-display text-3xl">
                Add services
              </h2>
              <p className="mt-2 mb-5 text-sm text-muted-foreground">
                Priced by the booking engine and added to your total immediately.
              </p>
              <AddOnPicker addOns={addOns} criteria={criteria} selected={quote.addOnIds} />
            </section>
          </div>

          {/* Sticky booking summary */}
          <aside aria-labelledby="summary-heading" className="lg:sticky lg:top-28 lg:h-fit">
            <div className="rounded-[28px] bg-card p-6 shadow-soft">
              <h2 id="summary-heading" className="text-display text-2xl">
                Your stay
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{formatDateRange(criteria.checkIn, criteria.checkOut)}</p>
              <p className="text-sm text-muted-foreground">
                {formatNights(quote.price.nights)} · {formatGuests(criteria.adults, criteria.children)}
              </p>

              <div className="mt-5 border-t border-border pt-5">
                <QuoteLines quote={quote} />
              </div>

              <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-border pt-5">
                <span className="text-sm font-medium">Total</span>
                <span className="text-display text-4xl">{formatMoney(quote.price.total, quote.price.currency)}</span>
              </div>

              {quote.price.otaComparisonTotal && quote.price.directSaving > 0 ? (
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  <span className="font-medium text-accent-strong">
                    {formatMoney(quote.price.directSaving, quote.price.currency)} less
                  </span>{' '}
                  than the {formatMoney(quote.price.otaComparisonTotal, quote.price.currency)} demo partner-site
                  price. A simulated comparison, not a live rate.
                </p>
              ) : null}

              {soldOut ? (
                <div className="mt-6">
                  <p role="status" className="rounded-2xl bg-danger/10 p-3 text-sm text-danger">
                    This room is sold out for {formatDateRange(criteria.checkIn, criteria.checkOut)}.
                  </p>
                  <Link href={`/rooms?${stayQuery}`} className={pill('secondary', 'mt-3 w-full')}>
                    See available rooms
                  </Link>
                </div>
              ) : (
                <Link href={`/book/${room.slug}?${bookQuery}`} className={pill('primary', 'mt-6 min-h-12 w-full')}>
                  Book this room
                </Link>
              )}

              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                Demo booking. Payment is simulated and no card details are collected.
              </p>
            </div>
          </aside>
        </div>
      </main>
      <MobileBookBar quote={quote} bookHref={`/book/${room.slug}?${bookQuery}`} roomsHref={`/rooms?${stayQuery}`} />
      <SiteFooter />
    </>
  );
}
