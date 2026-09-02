import Link from 'next/link';
import { ArrowUpRight, Bed, Buildings, Check, Eye, Ruler, UsersThree } from '@phosphor-icons/react/dist/ssr';
import { coverPhoto, roomCategory } from '@/lib/domain/room-attributes';
import type { RoomOffer } from '@/lib/domain/schemas';
import { bedLabels, categoryLabels, formatFloor, formatMoney, formatNights, viewLabels } from '@/lib/formatting';
import { pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { StatusBadge } from './status-badge';

interface RoomCardProps {
  offer: RoomOffer;
  /** Canonical stay query so the card's links keep dates, guests, and filters. */
  stayQuery: string;
}

export function RoomCard({ offer, stayQuery }: RoomCardProps) {
  const { room, ratePlan, price, status, remaining } = offer;
  const soldOut = status === 'sold_out';
  const detailHref = `/rooms/${room.slug}?${stayQuery}`;
  const bookHref = `/book/${room.slug}?${stayQuery}`;
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
        'group grid overflow-hidden rounded-[28px] bg-card shadow-soft transition-shadow hover:shadow-soft-lg md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]',
        soldOut && 'opacity-90',
      )}
    >
      <Link
        href={detailHref}
        aria-label={`View ${room.name}`}
        className="relative block aspect-[4/3] overflow-hidden bg-stone md:aspect-auto md:min-h-[19rem]"
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

      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{categoryLabels[roomCategory(room)]}</p>
            <h3 className="text-display mt-1 text-[1.75rem]">
              <Link href={detailHref} className="hover:text-accent-strong">
                {room.name}
              </Link>
            </h3>
          </div>
          <Link
            href={detailHref}
            aria-label={`Open ${room.name}`}
            className="hidden size-11 shrink-0 place-items-center rounded-full border border-border transition-colors hover:bg-stone sm:grid"
          >
            <ArrowUpRight weight="bold" className="size-4" aria-hidden="true" />
          </Link>
        </header>

        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{room.description}</p>

        <ul className="flex flex-wrap gap-1.5">
          {facts.map((fact) => (
            <li key={fact.label} className={tag()}>
              <fact.icon weight="fill" className="size-3.5 text-muted-foreground" aria-hidden="true" />
              {fact.label}
            </li>
          ))}
        </ul>

        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
          {ratePlan.includedServices.slice(0, 2).map((service) => (
            <li key={service} className="flex items-center gap-2">
              <Check weight="bold" className="size-4 shrink-0 text-success" aria-hidden="true" />
              {service}
            </li>
          ))}
          <li className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
            <Check weight="bold" className="size-4 shrink-0 text-success" aria-hidden="true" />
            {ratePlan.cancellationPolicy}
          </li>
        </ul>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-4 border-t border-border pt-5">
          <div>
            <p className="flex items-baseline gap-1.5">
              <span className="text-display text-3xl">{formatMoney(price.nightlyPrice, price.currency)}</span>
              <span className="text-sm text-muted-foreground">a night</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatMoney(price.total, price.currency)} for {formatNights(price.nights)}, taxes in
              {price.otaComparisonTotal && price.directSaving > 0 ? (
                <>
                  {' '}
                  · <span className="text-accent-strong">save {formatMoney(price.directSaving, price.currency)} direct</span>
                </>
              ) : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href={detailHref} className={pill('secondary')}>
              Details
            </Link>
            {soldOut ? (
              <span aria-disabled="true" className={pill('secondary', 'cursor-not-allowed text-muted-foreground')}>
                Sold out
              </span>
            ) : (
              <Link href={bookHref} className={pill('primary')}>
                Book now
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
