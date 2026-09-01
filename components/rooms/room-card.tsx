import Link from 'next/link';
import { BedDouble, Building2, Check, Eye, Maximize, Users } from 'lucide-react';
import { roomCategory } from '@/lib/domain/room-attributes';
import type { RoomOffer } from '@/lib/domain/schemas';
import {
  bedLabels,
  categoryLabels,
  formatFloor,
  formatMoney,
  formatNights,
  viewLabels,
} from '@/lib/formatting';
import { cn } from '@/lib/utils';
import { MediaBadges } from './media-badges';
import { RoomVisual } from './room-visual';
import { StatusBadge } from './status-badge';

interface RoomCardProps {
  offer: RoomOffer;
  /** Canonical stay query so the card's links keep dates, guests, and filters. */
  stayQuery: string;
  layout?: 'row' | 'grid';
}

export function RoomCard({ offer, stayQuery, layout = 'row' }: RoomCardProps) {
  const { room, ratePlan, price, status, remaining } = offer;
  const soldOut = status === 'sold_out';
  const detailHref = `/rooms/${room.slug}?${stayQuery}`;
  const bookHref = `/book/${room.slug}?${stayQuery}`;
  const specs = [
    { icon: Maximize, label: `${room.areaM2} m²` },
    { icon: Building2, label: formatFloor(room.floor) },
    { icon: Users, label: `Up to ${room.capacity}` },
    { icon: BedDouble, label: bedLabels[room.bedType] },
    { icon: Eye, label: viewLabels[room.view] },
  ];

  return (
    <article
      className={cn(
        'group grid overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-shadow focus-within:shadow-soft-lg hover:shadow-soft-lg',
        layout === 'row' ? 'sm:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]' : 'grid-rows-[auto_1fr]',
        soldOut && 'opacity-95',
      )}
    >
      <div className={cn('relative bg-ink', layout === 'row' ? 'aspect-[4/3] sm:aspect-auto' : 'aspect-[4/3]')}>
        <RoomVisual room={room} className={cn(soldOut && 'saturate-[0.35]')} />
        <MediaBadges room={room} className="absolute top-3 left-3" />
        <StatusBadge
          status={status}
          remaining={remaining}
          className="absolute top-3 right-3 bg-card/95 backdrop-blur-sm"
        />
      </div>

      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <header>
          <p className="eyebrow text-muted-foreground">
            {categoryLabels[roomCategory(room)]} · {viewLabels[room.view]}
          </p>
          <h3 className="text-display mt-1.5 text-2xl">
            <Link href={detailHref} className="rounded-sm hover:text-cyan-dark">
              {room.name}
            </Link>
          </h3>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {room.description}
          </p>
        </header>

        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-muted-foreground">
          {specs.map((spec) => (
            <li key={spec.label} className="flex items-center gap-1.5">
              <spec.icon className="size-3.5 shrink-0" aria-hidden="true" />
              {spec.label}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-1.5">
          {room.amenities.slice(0, 4).map((amenity) => (
            <span
              key={amenity}
              className="rounded-full border border-border bg-canvas px-2.5 py-1 text-xs text-muted-foreground"
            >
              {amenity}
            </span>
          ))}
          {room.amenities.length > 4 ? (
            <span className="rounded-full border border-border bg-canvas px-2.5 py-1 text-xs text-muted-foreground">
              +{room.amenities.length - 4} more
            </span>
          ) : null}
        </div>

        <div className="rounded-2xl bg-canvas p-3.5 text-[13px]">
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {ratePlan.includedServices.slice(0, 4).map((service) => (
              <li key={service} className="flex items-start gap-1.5">
                <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
                <span>{service}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 border-t border-border pt-2.5 text-muted-foreground">
            {ratePlan.cancellationPolicy}
          </p>
        </div>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4">
          <div>
            <p className="flex items-baseline gap-1.5">
              <span className="text-display text-3xl">
                {formatMoney(price.nightlyPrice, price.currency)}
              </span>
              <span className="text-sm text-muted-foreground">per night</span>
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {formatMoney(price.total, price.currency)} total for{' '}
              {formatNights(price.nights)}, taxes included
            </p>
            {price.otaComparisonTotal && price.directSaving > 0 ? (
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px]">
                <span className="text-muted-foreground line-through">
                  {formatMoney(price.otaComparisonTotal, price.currency)}
                </span>
                <span className="rounded-full bg-cyan/15 px-2 py-0.5 text-xs font-semibold text-cyan-dark">
                  Save {formatMoney(price.directSaving, price.currency)} direct
                </span>
                <span className="text-xs text-muted-foreground">(demo comparison)</span>
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={detailHref}
              className="flex min-h-11 items-center rounded-xl border border-border bg-card px-4 text-sm font-semibold transition-colors hover:bg-canvas"
            >
              View details
            </Link>
            {soldOut ? (
              <span
                aria-disabled="true"
                className="flex min-h-11 cursor-not-allowed items-center rounded-xl border border-border bg-canvas px-4 text-sm font-semibold text-muted-foreground"
              >
                Sold out
              </span>
            ) : (
              <Link
                href={bookHref}
                className="flex min-h-11 items-center rounded-xl bg-cyan px-4 text-sm font-semibold text-ink transition-colors hover:bg-cyan/85"
              >
                Book now
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
