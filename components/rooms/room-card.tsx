import Link from 'next/link';
import {
  Bed,
  Buildings,
  CalendarCheck,
  Eye,
  Ruler,
  UsersThree,
} from '@phosphor-icons/react/dist/ssr';
import { ArrowUpRightIcon } from '@heroicons/react/24/outline';
import { coverPhoto, roomCategory } from '@/lib/domain/room-attributes';
import type { RoomOffer } from '@/lib/domain/schemas';
import { bedLabels, categoryLabels, formatFloor, formatMoney, formatNights, viewLabels } from '@/lib/formatting';
import { iconButton, pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { featureIcon } from './feature-icon';
import { StatusBadge } from './status-badge';

interface RoomCardProps {
  offer: RoomOffer;
  /** Canonical stay query so the card's links keep dates, guests, and filters. */
  stayQuery: string;
}

/**
 * A vertical tile for a grid of rooms — photo over facts over price, the
 * shape every OTA search result uses because it reads the same whether the
 * row holds two cards or four. `RoomStrip` is the lighter sibling for a
 * browse-on rail; this one carries the full case for the room, but every
 * link on it — photo, name, arrow, "See details" — opens the same detail
 * page. Nothing here skips straight into the booking flow: that decision,
 * and the "Book this room" that starts it, live on the page where the guest
 * has actually seen the room.
 */
export function RoomCard({ offer, stayQuery }: RoomCardProps) {
  const { room, ratePlan, price, status, remaining } = offer;
  const soldOut = status === 'sold_out';
  const detailHref = `/rooms/${room.slug}?${stayQuery}`;
  const cover = coverPhoto(room);
  const facts = [
    { icon: Ruler, label: `${room.areaM2} m²` },
    { icon: Bed, label: bedLabels[room.bedType] },
    { icon: UsersThree, label: `Sleeps ${room.capacity}` },
    { icon: Buildings, label: formatFloor(room.floor) },
    { icon: Eye, label: viewLabels[room.view] },
  ];

  return (
    <article
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-[28px] bg-card shadow-soft transition-shadow hover:shadow-soft-lg',
        soldOut && 'opacity-90',
      )}
    >
      <Link
        href={detailHref}
        aria-label={`View ${room.name}`}
        className="relative block aspect-[4/3] overflow-hidden bg-stone"
      >
        {cover ? (
          <img
            src={cover.url}
            alt={cover.label ? `${room.name} — ${cover.label}` : room.name}
            width={cover.width}
            height={cover.height}
            loading="lazy"
            decoding="async"
            className={cn(
              'size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]',
              soldOut && 'saturate-50',
            )}
          />
        ) : null}
        <StatusBadge status={status} remaining={remaining} onPhoto className="absolute top-3 left-3" />
      </Link>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{categoryLabels[roomCategory(room)]}</p>
            <h3 className="text-display mt-0.5 text-xl">
              <Link href={detailHref} className="hover:text-accent-strong">
                {room.name}
              </Link>
            </h3>
          </div>
          <Link href={detailHref} aria-label={`Open ${room.name}`} className={iconButton('light', 'shrink-0')}>
            <ArrowUpRightIcon className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{room.description}</p>

        <ul className="flex flex-wrap gap-1.5">
          {facts.map((fact) => (
            <li key={fact.label} className={tag()}>
              <fact.icon weight="fill" className="size-3.5 text-muted-foreground" aria-hidden="true" />
              {fact.label}
            </li>
          ))}
        </ul>

        <ul className="flex flex-col gap-1.5 text-sm">
          {ratePlan.includedServices.slice(0, 2).map((service) => {
            const Icon = featureIcon(service);
            return (
              <li key={service} className="flex items-center gap-2">
                <Icon weight="fill" className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {service}
              </li>
            );
          })}
          <li className="flex items-center gap-2 text-muted-foreground">
            <CalendarCheck weight="fill" className="size-4 shrink-0" aria-hidden="true" />
            {ratePlan.cancellationPolicy}
          </li>
        </ul>

        <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
          <div>
            <p className="flex items-baseline gap-1.5">
              <span className="text-display text-2xl">{formatMoney(price.nightlyPrice, price.currency)}</span>
              <span className="text-sm text-muted-foreground">a night</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatMoney(price.total, price.currency)} for {formatNights(price.nights)}, taxes in
              {price.otaComparisonTotal && price.directSaving > 0 ? (
                <>
                  {' '}
                  · <span className="text-accent-strong">save {formatMoney(price.directSaving, price.currency)} direct</span>
                </>
              ) : null}
            </p>
          </div>

          {soldOut ? (
            <span
              aria-disabled="true"
              className={pill('secondary', 'w-full cursor-not-allowed justify-center text-muted-foreground')}
            >
              Sold out
            </span>
          ) : (
            // The card sells the idea of the room; the decision to book — and
            // the actual "Book this room" — belongs to the detail page, where
            // the full photo set, the rate plan, and the 360 view are. This
            // link only ever opens that page, never the booking flow directly.
            <Link href={detailHref} className={pill('primary', 'w-full justify-center')}>
              See details
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
