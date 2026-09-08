import Link from 'next/link';
import { coverPhoto } from '@/lib/domain/room-attributes';
import type { RoomOffer } from '@/lib/domain/schemas';
import { formatMoney } from '@/lib/formatting';
import { cn } from '@/lib/utils';

interface RoomStripProps {
  offers: RoomOffer[];
  /** Canonical stay query so every tile keeps the dates and guests. */
  stayQuery: string;
  className?: string;
  /** Lets `RoomStripControls` find this exact rail to page by id. */
  id?: string;
}

/**
 * The rest of the house, as a row of photographs. `RoomCard` carries the full
 * argument for a room and is too heavy to repeat once a page has already made
 * its recommendation; this is the browse-on version of it — the picture, the
 * name, and the one line that decides whether the guest opens it.
 *
 * It scrolls sideways rather than wrapping, so the row reads as "there is more
 * here" at any width. The negative margin lets tiles bleed to the screen edge
 * on a phone while the page keeps its own padding.
 */
export function RoomStrip({ offers, stayQuery, className, id }: RoomStripProps) {
  if (offers.length === 0) return null;

  return (
    <ul
      id={id}
      className={cn(
        'no-scrollbar -mx-3 flex snap-x snap-mandatory gap-4 overflow-x-auto px-3 pb-2 sm:-mx-6 sm:px-6',
        className,
      )}
    >
      {offers.map(({ room, price, status }) => {
        const cover = coverPhoto(room);
        const soldOut = status === 'sold_out';

        return (
          <li key={room.id} className="w-[15rem] shrink-0 snap-start sm:w-[17rem]">
            <Link href={`/rooms/${room.slug}?${stayQuery}`} className="group block">
              <div className="relative aspect-[3/4] overflow-hidden rounded-[28px] bg-stone">
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
              </div>
              <h3 className="text-display mt-3 text-xl transition-colors group-hover:text-accent-strong">
                {room.name}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {/* Size is the one fact that changes from tile to tile; the
                    capacity and view that used to sit here read the same
                    across the whole row. */}
                {room.areaM2} m² · from{' '}
                <span className="font-semibold text-foreground">
                  {formatMoney(price.nightlyPrice, price.currency)}
                </span>{' '}
                a night
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
