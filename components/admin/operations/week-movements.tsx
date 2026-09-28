'use client';

import * as React from 'react';
import type { Booking } from '@/lib/domain/schemas';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { cn } from '@/lib/utils';
import { Movements } from './movements-list';

type Tab = 'arrival' | 'departure';

/**
 * Arriving and leaving as two tabs sharing one lane, not two full lists
 * stacked — a week's worth of both used to run the card to twice a
 * screen's height. The counts stay on the tabs themselves, so switching
 * still shows how many are on the other side without opening it.
 */
export function WeekMovements({
  arriving,
  leaving,
  roomNames,
}: {
  arriving: Booking[];
  leaving: Booking[];
  roomNames: Map<string, string>;
}) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const [tab, setTab] = React.useState<Tab>('arrival');

  if (arriving.length === 0 && leaving.length === 0) {
    return (
      <p className="mt-6 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        {t('dashboard.noMovements')}
      </p>
    );
  }

  const bookings = tab === 'arrival' ? arriving : leaving;
  const dates = bookings.map((booking) => (tab === 'arrival' ? booking.checkIn : booking.checkOut));

  return (
    <div className="mt-4">
      <div role="tablist" aria-label={t('dashboard.next7Days')} className="mb-3 inline-flex gap-1 rounded-full bg-stone/60 p-1">
        {(
          [
            ['arrival', t('dashboard.arriving'), arriving.length],
            ['departure', t('dashboard.leaving'), leaving.length],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-sm font-medium tabular-nums transition-colors',
              tab === key ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label} · {count}
          </button>
        ))}
      </div>
      <Movements
        kind={tab}
        title={tab === 'arrival' ? t('dashboard.arriving') : t('dashboard.leaving')}
        hideHeader
        bookings={bookings}
        dates={dates}
        roomNames={roomNames}
        t={t}
        locale={locale}
        limit={8}
      />
    </div>
  );
}
