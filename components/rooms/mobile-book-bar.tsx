'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronUpIcon } from '@heroicons/react/24/outline';
import { QuoteLines } from '@/components/rooms/add-on-picker';
import { useRoomPricing } from '@/components/rooms/room-pricing';
import { StayDatesSummary } from '@/components/search/stay-dates-summary';
import { Modal } from '@/components/site/modal';
import { buildQuery } from '@/lib/application/search-params';
import type { StayCriteria } from '@/lib/domain/schemas';
import { useLocale, useT } from '@/lib/i18n/context';
import { lGuests, lMoney, lNights, lServiceCount } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';

interface MobileBookBarProps {
  roomSlug: string;
  criteria: StayCriteria;
  roomsHref: string;
}

/**
 * On phones the sticky summary ends up below the fold, so the total and the
 * one action ride along the bottom edge instead. Hidden from `lg` up, where
 * the summary column is always in view.
 *
 * The total is also the way into the bill. A guest who has added a transfer
 * and a dinner halfway down the page sees the number change, but not what
 * changed it — and the summary card that lists it is far below. Tapping the
 * total opens that same bill as a sheet: every line, removable in place, and
 * the button to book straight after it.
 */
export function MobileBookBar({ roomSlug, criteria, roomsHref }: MobileBookBarProps) {
  const t = useT();
  const { locale } = useLocale();
  const { quote, repricing } = useRoomPricing();
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  const bookHref = `/book/${roomSlug}?${buildQuery({ criteria, addOnIds: quote.addOnIds })}`;
  const soldOut = !quote.available;
  const { price } = quote;
  // Extras count with the thing they extend, not as orders of their own.
  const services = price.addOnLines.filter((line) => !line.parentId).length;

  const action = soldOut ? (
    <Link href={roomsHref} className={pill('secondary', 'h-11')}>
      {t('room.seeRooms')}
    </Link>
  ) : (
    <Link href={bookHref} className={pill('primary', 'h-11')}>
      {t('rooms.bookThisRoom')}
    </Link>
  );

  return (
    <>
      <div className="fixed inset-x-3 bottom-3 z-30 lg:hidden">
        <div className="glass flex items-center justify-between gap-3 rounded-full py-2 pr-2 pl-2 shadow-soft-lg">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={t('room.totalShowStay', { total: lMoney(price.total, price.currency, locale) })}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-full py-1 pr-2 pl-3 text-left transition-colors hover:bg-stone/60"
          >
            <span className="min-w-0">
              <span className={cn('text-display block text-xl leading-none', repricing && 'opacity-60')}>
                {lMoney(price.total, price.currency, locale)}
              </span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {soldOut
                  ? t('room.fullyBookedShort')
                  : services > 0
                    ? `${lNights(price.nights, locale)} · ${lServiceCount(services, locale)}`
                    : t('room.taxesIncluded', { nights: lNights(price.nights, locale) })}
              </span>
            </span>
            <ChevronUpIcon className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden="true" />
          </button>
          {action}
        </div>
      </div>

      <Modal open={open} onClose={close} title={t('room.yourStay')}>
        <StayDatesSummary checkIn={criteria.checkIn} checkOut={criteria.checkOut} />
        <p className="mt-2 text-sm text-muted-foreground">
          {lNights(price.nights, locale)} · {lGuests(criteria.adults, criteria.children, locale)}
        </p>

        <div className="mt-5 border-t border-border pt-5">
          <QuoteLines />
        </div>

        <div className="mt-5 flex items-baseline justify-between gap-4 border-t border-border pt-5">
          <span className="text-sm font-medium">{t('room.total')}</span>
          <span className={cn('text-display text-[2rem]', repricing && 'opacity-60')}>
            {lMoney(price.total, price.currency, locale)}
          </span>
        </div>

        <div className="mt-6 [&>a]:min-h-12 [&>a]:w-full">{action}</div>
      </Modal>
    </>
  );
}
