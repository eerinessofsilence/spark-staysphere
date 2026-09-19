'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu } from '@base-ui/react/menu';
import { AdjustmentsHorizontalIcon, CalendarIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { lNights } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { FrontDeskDateFilter } from './front-desk-date-filter';
import { frontDeskHref, WINDOW_OPTIONS } from './front-desk-shared';

const itemClass =
  'flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none select-none data-highlighted:bg-stone';

/**
 * The desktop toolbar's own "Filters": one button, icon and label, rather
 * than the 7/14/30/Custom segmented control sitting in the open — the
 * currently applied window is already spelled out beside it (the page's own
 * "Fri 18 Sep – Thu 1 Oct · 14 nights" line), so the button doesn't need to
 * echo it too. The phone's `FrontDeskMobileFilters` made the same call for
 * the same reason; this is that pattern's desktop half, minus the room-type
 * and colour-key sections the phone's sheet also holds — those stay their
 * own visible controls here, since there is room for them.
 */
export function FrontDeskWindowFilter({ from, days, type }: { from: string; days: number; type: string | null }) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const [datesOpen, setDatesOpen] = React.useState(false);
  const isCustom = !(WINDOW_OPTIONS as readonly number[]).includes(days);

  return (
    <>
      <Menu.Root modal={false}>
        <Menu.Trigger className={pill('secondary', 'min-h-10 gap-1.5 px-4 data-popup-open:bg-stone')}>
          <AdjustmentsHorizontalIcon className="size-4 shrink-0" aria-hidden="true" />
          {t('frontDesk.filters')}
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-50 outline-none">
            <Menu.Popup className="min-w-52 rounded-2xl border border-border bg-card p-1.5 text-foreground shadow-soft outline-none">
              <p className="px-3 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">{t('frontDesk.nightsShown')}</p>
              {WINDOW_OPTIONS.map((option) => (
                <Menu.LinkItem
                  key={option}
                  render={<Link href={frontDeskHref({ from, days: option, type })} />}
                  closeOnClick
                  className={itemClass}
                >
                  <span className="flex-1">{lNights(option, locale)}</span>
                  {option === days ? <CheckIcon className="size-4 shrink-0" aria-hidden="true" /> : null}
                </Menu.LinkItem>
              ))}
              <Menu.Item onClick={() => setDatesOpen(true)} className={itemClass}>
                <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1">{t('frontDesk.custom')}</span>
                {isCustom ? <CheckIcon className="size-4 shrink-0" aria-hidden="true" /> : null}
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <FrontDeskDateFilter from={from} days={days} type={type} open={datesOpen} onOpenChange={setDatesOpen} showTrigger={false} />
    </>
  );
}
