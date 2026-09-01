import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BedDouble, Building2, Check, Eye, Maximize, Users } from 'lucide-react';
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
import { AddOnPicker, QuoteLines } from '@/components/rooms/add-on-picker';
import { RoomGallery } from '@/components/rooms/room-gallery';
import { StatusBadge } from '@/components/rooms/status-badge';
import { Eyebrow } from '@/components/site/eyebrow';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';

export async function generateMetadata({
  params,
}: PageProps<'/rooms/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `${slug.replace(/-/g, ' ')} — Asteria Cove | SPARK StaySphere 360`,
  };
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

  const specs = [
    { icon: Maximize, label: 'Area', value: `${room.areaM2} m²` },
    { icon: Building2, label: 'Floor', value: formatFloor(room.floor) },
    { icon: Users, label: 'Sleeps', value: `Up to ${room.capacity} guests` },
    { icon: BedDouble, label: 'Bed', value: bedLabels[room.bedType] },
    { icon: Eye, label: 'Outlook', value: viewLabels[room.view] },
  ];

  return (
    <>
      <SiteHeader stayQuery={stayQuery} />
      <main id="main" className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">
        <nav aria-label="Breadcrumb" className="mb-5 text-sm">
          <Link
            href={`/rooms?${stayQuery}`}
            className="inline-flex min-h-11 items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            All rooms
          </Link>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-10">
          <div>
            <header className="mb-6">
              <div className="flex flex-wrap items-center gap-3">
                <Eyebrow>
                  {categoryLabels[roomCategory(room)]} · {hotel.name}
                </Eyebrow>
                <StatusBadge status={offer.status} remaining={offer.remaining} />
              </div>
              <h1 className="text-display mt-3 text-4xl sm:text-5xl">{room.name}</h1>
              <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
                {room.description}
              </p>
            </header>

            <RoomGallery room={room} />

            <section aria-labelledby="specs-heading" className="mt-10">
              <h2 id="specs-heading" className="text-display text-2xl">
                The room
              </h2>
              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {specs.map((spec) => (
                  <div key={spec.label} className="rounded-2xl border border-border bg-card p-4">
                    <dt className="eyebrow flex items-center gap-1.5 text-muted-foreground">
                      <spec.icon className="size-3.5" aria-hidden="true" />
                      {spec.label}
                    </dt>
                    <dd className="mt-1.5 text-sm font-semibold">{spec.value}</dd>
                  </div>
                ))}
              </dl>

              <h3 className="mt-8 text-sm font-semibold">Amenities</h3>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {room.amenities.map((amenity) => (
                  <li key={amenity} className="flex items-center gap-2 text-sm">
                    <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
                    {amenity}
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="rate-heading" className="mt-10">
              <h2 id="rate-heading" className="text-display text-2xl">
                {ratePlan.name}
              </h2>
              <div className="mt-4 rounded-3xl border border-border bg-card p-5">
                <ul className="grid gap-2 sm:grid-cols-2">
                  {ratePlan.includedServices.map((service) => (
                    <li key={service} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                      {service}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
                  {ratePlan.cancellationPolicy}
                </p>
              </div>
            </section>

            <section aria-labelledby="addons-heading" className="mt-10">
              <h2 id="addons-heading" className="text-display text-2xl">
                Add services
              </h2>
              <p className="mt-2 mb-4 text-sm text-muted-foreground">
                Selections are priced by the booking engine and appear in your total immediately.
              </p>
              <AddOnPicker addOns={addOns} criteria={criteria} selected={quote.addOnIds} />
            </section>
          </div>

          {/* Sticky booking summary */}
          <aside aria-labelledby="summary-heading" className="lg:sticky lg:top-24 lg:h-fit">
            <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
              <h2 id="summary-heading" className="text-display text-xl">
                Your stay
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {formatDateRange(criteria.checkIn, criteria.checkOut)}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatNights(quote.price.nights)} · {formatGuests(criteria.adults, criteria.children)}
              </p>

              <div className="mt-4 border-t border-border pt-4">
                <QuoteLines quote={quote} />
              </div>

              <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-border pt-4">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-display text-3xl">
                  {formatMoney(quote.price.total, quote.price.currency)}
                </span>
              </div>

              {quote.price.otaComparisonTotal && quote.price.directSaving > 0 ? (
                <p className="mt-2 rounded-xl bg-cyan/10 p-3 text-xs leading-relaxed text-cyan-dark">
                  <span className="font-semibold">
                    {formatMoney(quote.price.directSaving, quote.price.currency)} less than the{' '}
                    {formatMoney(quote.price.otaComparisonTotal, quote.price.currency)} demo
                    partner-site price
                  </span>{' '}
                  — a simulated comparison, not a live OTA rate.
                </p>
              ) : null}

              {soldOut ? (
                <div className="mt-5">
                  <p
                    role="status"
                    className="rounded-xl border border-danger/25 bg-danger/10 p-3 text-sm text-danger"
                  >
                    This room is sold out for {formatDateRange(criteria.checkIn, criteria.checkOut)}.
                  </p>
                  <Link
                    href={`/rooms?${stayQuery}`}
                    className="mt-3 flex min-h-11 items-center justify-center rounded-2xl border border-border bg-card px-4 text-sm font-semibold hover:bg-canvas"
                  >
                    See available rooms
                  </Link>
                </div>
              ) : (
                <Link
                  href={`/book/${room.slug}?${bookQuery}`}
                  className="mt-5 flex min-h-12 items-center justify-center rounded-2xl bg-cyan px-4 text-sm font-semibold text-ink transition-colors hover:bg-cyan/85"
                >
                  Book this room
                </Link>
              )}

              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Demo booking. Payment is simulated and no card details are collected.
              </p>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
