'use client';

import { QuoteLines } from '@/components/rooms/add-on-picker';
import { useRoomPricing } from '@/components/rooms/room-pricing';
import { StayDatesSummary } from '@/components/search/stay-dates-summary';
import type { StayCriteria } from '@/lib/domain/schemas';
import { useLocale, useT } from '@/lib/i18n/context';
import { catalogCopy } from '@/lib/i18n/catalog-copy';
import { lGuests, lMoney, lNights } from '@/lib/i18n/format';
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
export function RoomSummary({ criteria }: RoomSummaryProps) {
  const t = useT();
  const { locale } = useLocale();
  const { quote, bookingUrl } = useRoomPricing();
  const copy = catalogCopy(locale);

  return (
    <aside aria-labelledby="summary-heading" className="lg:sticky lg:top-28 lg:h-fit">
      <div className="rounded-[18px] bg-card p-6 shadow-soft">
        <h2 id="summary-heading" className="text-sm font-medium text-muted-foreground">
          {t('room.yourStay')}
        </h2>
        {/* The dates are what is actually being booked — the same voice
            the price gets below, not a footnote under a card title. */}
        <StayDatesSummary checkIn={criteria.checkIn} checkOut={criteria.checkOut} className="mt-3" />
        <p className="mt-2 text-sm text-muted-foreground">
          {lNights(quote.price.nights, locale)} · {lGuests(criteria.adults, criteria.children, locale)}
        </p>

        <div className="mt-5 border-t border-border pt-5">
          <QuoteLines />
        </div>

        <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-border pt-5">
          <span className="text-sm font-medium">{t('room.total')}</span>
          {/* Same size as the checkout review's sidebar total (booking-flow.tsx)
              — same card, two steps of the same decision. */}
          <span className="text-display text-[2rem]">{quote.referencePriceAvailable ? lMoney(quote.price.total, quote.price.currency, locale) : copy.onRequest}</span>
        </div>

        {quote.price.otaComparisonTotal && quote.price.directSaving > 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-accent-strong">
              {t('room.lessThanPartnerPricePrefix', { saving: lMoney(quote.price.directSaving, quote.price.currency, locale) })}
            </span>{' '}
            {t('room.thanPartnerPrice', { price: lMoney(quote.price.otaComparisonTotal, quote.price.currency, locale) })}
          </p>
        ) : null}

        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{copy.hint}</p>
        {bookingUrl ? <a href={bookingUrl} className={pill('primary', 'mt-6 min-h-12 w-full')}>
          {copy.checkAvailability}
        </a> : null}
      </div>
    </aside>
  );
}
