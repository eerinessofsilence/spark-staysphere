'use client';

import * as React from 'react';
import Link from 'next/link';
import { AdjustmentsHorizontalIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { addIsoDays } from '@/lib/domain/dates';
import { formatDateShort } from '@/lib/formatting';
import { iconButton, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/site/modal';
import { FrontDeskDateFilter } from './front-desk-date-filter';
import { FrontDeskLegend } from './front-desk-legend';
import { DEFAULT_WINDOW, frontDeskHref, WINDOW_OPTIONS } from './front-desk-shared';
import { RoomTypeSelect } from './room-type-select';

/**
 * The phone's version of the front desk controls: one filter button opening
 * a sheet with the nights shown, the room type, and the colour key, instead
 * of three rows of controls stacked above the board.
 */
export function FrontDeskMobileFilters({
  from,
  days,
  type,
  roomTypes,
}: {
  from: string;
  days: number;
  type: string | null;
  roomTypes: { id: string; name: string }[];
}) {
  const [open, setOpen] = React.useState(false);
  const [datesOpen, setDatesOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const isCustom = !(WINDOW_OPTIONS as readonly number[]).includes(days);
  const active = (days !== DEFAULT_WINDOW ? 1 : 0) + (type ? 1 : 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={active ? `Filters, ${active} applied` : 'Filters'}
        className={cn(iconButton('light'), 'relative')}
      >
        <AdjustmentsHorizontalIcon className="size-5" aria-hidden="true" />
        {active ? (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground"
          >
            {active}
          </span>
        ) : null}
      </button>

      <Modal open={open} onClose={close} title="Filters">
        <div className="grid gap-6">
          <div role="group" aria-labelledby="front-desk-filter-nights">
            <h3 id="front-desk-filter-nights" className="text-sm font-medium">
              Nights shown
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {WINDOW_OPTIONS.map((option) => (
                <Link
                  key={option}
                  href={frontDeskHref({ from, days: option, type })}
                  onClick={close}
                  aria-current={option === days ? 'true' : undefined}
                  className={pill(option === days ? 'primary' : 'secondary', 'w-full')}
                >
                  {option} nights
                </Link>
              ))}
              <button
                type="button"
                onClick={() => {
                  close();
                  setDatesOpen(true);
                }}
                aria-current={isCustom ? 'true' : undefined}
                className={pill(isCustom ? 'primary' : 'secondary', 'w-full')}
              >
                <CalendarIcon className="size-4 shrink-0" aria-hidden="true" />
                {isCustom ? `${formatDateShort(from)} – ${formatDateShort(addIsoDays(from, days - 1))}` : 'Custom'}
              </button>
            </div>
          </div>

          <div role="group" aria-labelledby="front-desk-filter-type">
            <h3 id="front-desk-filter-type" className="text-sm font-medium">
              Room type
            </h3>
            <div className="mt-2">
              <RoomTypeSelect id="front-desk-room-type-mobile" options={roomTypes} value={type} from={from} days={days} />
            </div>
          </div>

          <div role="group" aria-labelledby="front-desk-filter-key">
            <h3 id="front-desk-filter-key" className="text-sm font-medium">
              Colour key
            </h3>
            <div className="mt-3">
              <FrontDeskLegend />
            </div>
          </div>

          <div className="flex gap-2 border-t border-border pt-4">
            {active ? (
              <Link href={frontDeskHref({ from, days: DEFAULT_WINDOW, type: null })} onClick={close} className={pill('secondary', 'flex-1')}>
                Reset
              </Link>
            ) : null}
            <button type="button" onClick={close} className={pill('primary', 'flex-1')}>
              Done
            </button>
          </div>
        </div>
      </Modal>

      <FrontDeskDateFilter from={from} days={days} type={type} open={datesOpen} onOpenChange={setDatesOpen} showTrigger={false} />
    </>
  );
}
