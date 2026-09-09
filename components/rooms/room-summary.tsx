'use client';

import Link from 'next/link';
import { QuoteLines } from '@/components/rooms/add-on-picker';
import { useRoomPricing } from '@/components/rooms/room-pricing';
import { StayDatesSummary } from '@/components/search/stay-dates-summary';
import { buildQuery } from '@/lib/application/search-params';
import type { StayCriteria } from '@/lib/domain/schemas';
import { formatDateRange, formatGuests, formatMoney, formatNights } from '@/lib/formatting';
import { pill } from '@/lib/ui';

interface RoomSummaryProps {
  roomSlug: string;
  criteria: StayCriteria;
  /** Where "See available rooms" goes — the stay without any services on it. */
  roomsHref: string;
  soldOut: boolean;
}

/**
 * The sticky bill. It reads the live quote rather than a server prop so that
 * adding a service updates the total in place, without the page reloading
 * under the guest.
 */
export function RoomSummary({ roomSlug, criteria, roomsHref, soldOut }: RoomSummaryProps) {
  const { quote } = useRoomPricing();
  const bookQuery = buildQuery({ criteria, addOnIds: quote.addOnIds });

  return (
    <aside aria-labelledby="summary-heading" className="lg:sticky lg:top-28 lg:h-fit">
      <div className="rounded-[28px] bg-card p-6 shadow-soft">
        <h2 id="summary-heading" className="text-sm font-medium text-muted-foreground">
          Your stay
        </h2>
        {/* The dates are what is actually being booked — the same voice
            the price gets below, not a footnote under a card title. */}
        <StayDatesSummary checkIn={criteria.checkIn} checkOut={criteria.checkOut} className="mt-3" />
        <p className="mt-2 text-sm text-muted-foreground">
          {formatNights(quote.price.nights)} · {formatGuests(criteria.adults, criteria.children)}
        </p>

        <div className="mt-5 border-t border-border pt-5">
          <QuoteLines />
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
              This room is fully booked for {formatDateRange(criteria.checkIn, criteria.checkOut)}.
            </p>
            <Link href={roomsHref} className={pill('secondary', 'mt-3 w-full')}>
              See available rooms
            </Link>
          </div>
        ) : (
          <Link href={`/book/${roomSlug}?${bookQuery}`} className={pill('primary', 'mt-6 min-h-12 w-full')}>
            Book this room
          </Link>
        )}

        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Demo booking. Payment is simulated and no card details are collected.
        </p>
      </div>
    </aside>
  );
}
