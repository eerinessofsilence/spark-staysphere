import Link from 'next/link';
import { Bed, Buildings, Eye, Ruler, UsersThree } from '@phosphor-icons/react/dist/ssr';
import { coverPhoto } from '@/lib/domain/room-attributes';
import type { RoomOffer } from '@/lib/domain/schemas';
import { bedLabels, formatFloor, formatMoney, formatNights, viewLabels } from '@/lib/formatting';
import { pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { factTone, featureIcon, tintInk, tintSurface } from './feature-icon';

interface RoomCardProps {
  offer: RoomOffer;
  /** Canonical stay query so the card's links keep dates, guests, and filters. */
  stayQuery: string;
  /**
   * `tile` is the scanning shape — six to a row, a photograph and the four
   * things a guest chooses between. `row` is the reading shape, for a guest
   * who has stopped scanning: the same room laid across the page with the
   * description, its facts and what the rate includes.
   */
  layout?: 'tile' | 'row';
}

/**
 * One room in the catalog, in whichever of the two shapes the guest asked for.
 *
 * Both are the same argument at different lengths, and both are one link to
 * the room's own page. The tile carries no button — an affordance that
 * repeats what clicking the card already does — and never opens the booking
 * flow: that decision belongs on the page where the guest has seen the room.
 * The row is that case laid out in full, so it does carry "Book this room":
 * a guest reading the description, the facts and the rate has seen enough
 * to decide, and sending them through one more page first is a toll.
 */
export function RoomCard({ offer, stayQuery, layout = 'tile' }: RoomCardProps) {
  const { room, ratePlan, price, status } = offer;
  // With twenty room types and tight scarcity on the rarer suites, a badge
  // on every third catalog tile made the whole page read as mostly closed.
  // Availability still gates the room page and the booking flow, where it
  // decides whether the guest can go on — here it is only this fade.
  const soldOut = status === 'sold_out';
  const cover = coverPhoto(room);
  const href = `/rooms/${room.slug}?${stayQuery}`;
  const row = layout === 'row';

  const photo = (
    <div
      className={cn(
        'relative overflow-hidden bg-stone',
        row ? 'aspect-[4/3] sm:aspect-auto sm:h-full' : 'aspect-[4/3]',
      )}
    >
      {cover ? (
        // Out of the flow, not merely filling its box. In the row layout the
        // frame's height is `h-full` of a grid row the text defines, which is
        // indefinite while the row is being measured — so an in-flow image
        // falls back to its own natural height and a portrait cover makes the
        // card taller than anything in it, stranding the price at the bottom
        // of a column of white. Absolute, the photograph measures nothing and
        // every card in the list is the height of its own words.
        <img
          src={cover.url}
          alt={cover.label ? `${room.name} — ${cover.label}` : room.name}
          width={cover.width}
          height={cover.height}
          loading="lazy"
          decoding="async"
          className={cn(
            'absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]',
            soldOut && 'saturate-50',
          )}
        />
      ) : null}
    </div>
  );

  const name = (
    <h3 className={cn('text-display leading-tight', row ? 'text-2xl' : 'text-base @xs:text-lg')}>
      {/* Stretched: the card has no button, so the whole of it is the target
          rather than these few words. */}
      <Link href={href} className="before:absolute before:inset-0">
        {room.name}
      </Link>
    </h3>
  );

  const priceBlock = (
    <div>
      <p>
        <span className={cn('text-display', row ? 'text-2xl' : 'text-lg @xs:text-2xl')}>
          {formatMoney(price.nightlyPrice, price.currency)}
        </span>
        <span className={cn('text-muted-foreground', row ? 'text-xs' : 'text-xs @xs:text-sm')}> a night</span>
      </p>
      {row ? (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatMoney(price.total, price.currency)} for {formatNights(price.nights)}, taxes in
        </p>
      ) : null}
    </div>
  );

  if (!row) {
    return (
      // `@container`: the tile's type follows the tile's own width, not the
      // viewport's. Four across a wide rail it is 330px and sets its name at
      // 18px; four across the catalog column, or two across a phone, it is
      // under 20rem and keeps the smaller scale — one component, no prop.
      <article
        className={cn(
          'group @container relative flex h-full flex-col overflow-hidden rounded-[20px] bg-card shadow-soft transition-shadow hover:shadow-soft-lg',
          soldOut && 'opacity-90',
        )}
      >
        {photo}
        <div className="flex flex-1 flex-col gap-1 p-3.5 @xs:gap-1.5 @xs:p-5">
          {name}
          {/* The one line under the name has to differ from tile to tile or it
              is noise: capacity echoed the search, and on a sea-facing house
              the view read the same on nearly every card. Size and bed are the
              two facts a guest actually weighs between two photographs. */}
          <p className="text-xs text-muted-foreground @xs:text-sm">
            {room.areaM2} m² · {bedLabels[room.bedType]}
          </p>
          <div className="mt-auto pt-2">{priceBlock}</div>
        </div>
      </article>
    );
  }

  const facts = [
    { icon: Ruler, label: `${room.areaM2} m²`, tone: factTone.area },
    { icon: Bed, label: bedLabels[room.bedType], tone: factTone.bed },
    { icon: UsersThree, label: `Sleeps ${room.capacity}`, tone: factTone.capacity },
    { icon: Buildings, label: formatFloor(room.floor), tone: factTone.floor },
    { icon: Eye, label: viewLabels[room.view], tone: factTone.view },
  ];

  return (
    <article
      className={cn(
        'group relative grid overflow-hidden rounded-[28px] bg-card shadow-soft transition-shadow hover:shadow-soft-lg',
        'sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]',
        soldOut && 'opacity-90',
      )}
    >
      {photo}

      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div>
          {name}
          <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {room.description}
          </p>
        </div>

        <ul className="flex flex-wrap gap-1.5">
          {facts.map((fact) => (
            <li key={fact.label} className={tag(tintSurface[fact.tone])}>
              <fact.icon weight="fill" className={cn('size-3.5', tintInk[fact.tone])} aria-hidden="true" />
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
        </ul>

        <div className="mt-auto flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-end sm:justify-between">
          {priceBlock}
          {/* Above the stretched link, or the card would swallow the click.
              A room with nothing left offers no button: the card still opens
              the room page, which says so in words. */}
          {soldOut ? null : (
            <Link
              href={`/book/${room.slug}?${stayQuery}`}
              className={pill('primary', 'relative z-10 w-full sm:w-auto')}
            >
              Book this room
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
