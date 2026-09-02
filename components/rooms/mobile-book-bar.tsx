import Link from 'next/link';
import type { Quote } from '@/lib/domain/schemas';
import { formatMoney, formatNights } from '@/lib/formatting';
import { pill } from '@/lib/ui';

interface MobileBookBarProps {
  quote: Quote;
  bookHref: string;
  roomsHref: string;
}

/**
 * On phones the sticky summary ends up below the fold, so the total and the
 * one action ride along the bottom edge instead. Hidden from `lg` up, where
 * the summary column is always in view.
 */
export function MobileBookBar({ quote, bookHref, roomsHref }: MobileBookBarProps) {
  const soldOut = !quote.available;
  return (
    <div className="fixed inset-x-3 bottom-3 z-30 lg:hidden">
      <div className="glass flex items-center justify-between gap-3 rounded-full border border-white/60 py-2 pr-2 pl-5 shadow-soft-lg">
        <div className="min-w-0">
          <p className="text-display text-xl leading-none">{formatMoney(quote.price.total, quote.price.currency)}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {soldOut ? 'Sold out for these dates' : `${formatNights(quote.price.nights)}, taxes included`}
          </p>
        </div>
        {soldOut ? (
          <Link href={roomsHref} className={pill('secondary', 'h-11')}>
            See rooms
          </Link>
        ) : (
          <Link href={bookHref} className={pill('primary', 'h-11')}>
            Book this room
          </Link>
        )}
      </div>
    </div>
  );
}
