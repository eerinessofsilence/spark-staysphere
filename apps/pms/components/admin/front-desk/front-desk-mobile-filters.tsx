'use client';

import * as React from 'react';
import Link from 'next/link';
import { AdjustmentsHorizontalIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { addIsoDays } from '@/lib/domain/dates';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { lDateShort, lNights } from '@/lib/i18n/format';
import { iconButton, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/site/modal';
import { FrontDeskDateFilter } from './front-desk-date-filter';
import { FrontDeskLegend } from './front-desk-legend';
import { DEFAULT_WINDOW, frontDeskHref, WINDOW_OPTIONS } from './front-desk-shared';
import { RoomTypeSelect } from './room-type-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface FrontDeskRackFilters {
  status: string;
  source: string;
  roomLock: '' | 'locked' | 'unlocked';
  floor: string;
}

/**
 * Compact controls for the front desk: one filter button opens the period,
 * room type and colour key on every viewport.
 */
export function FrontDeskMobileFilters({
  from,
  days,
  type,
  roomTypes,
  floors,
  sources,
  rackFilters,
  onRackFiltersChange,
}: {
  from: string;
  days: number;
  type: string | null;
  roomTypes: { id: string; name: string }[];
  floors: number[];
  sources: string[];
  rackFilters: FrontDeskRackFilters;
  onRackFiltersChange: React.Dispatch<React.SetStateAction<FrontDeskRackFilters>>;
}) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const [open, setOpen] = React.useState(false);
  const [datesOpen, setDatesOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const isCustom = !(WINDOW_OPTIONS as readonly number[]).includes(days);
  const active = (days !== DEFAULT_WINDOW ? 1 : 0) + (type ? 1 : 0) + Object.values(rackFilters).filter(Boolean).length;
  const updateRack = (key: keyof FrontDeskRackFilters, value: string) => onRackFiltersChange((current) => ({ ...current, [key]: value }));
  const fieldItems = {
    status: [
      { value: '', label: t('frontDesk.allReservations') },
      { value: 'confirmed', label: t('frontDesk.stayConfirmed') },
      { value: 'due_in', label: t('frontDesk.stayDueIn') },
      { value: 'in_house', label: t('frontDesk.stayInHouse') },
      { value: 'due_out', label: t('frontDesk.stayDueOut') },
      { value: 'checked_out', label: t('frontDesk.stayCheckedOut') },
      { value: 'no_show', label: t('frontDesk.stayNoShow') },
    ],
    source: [{ value: '', label: t('frontDesk.allSources') }, { value: 'direct', label: t('frontDesk.sourceDirect') }, ...sources.map((source) => ({ value: source, label: source }))],
    roomLock: [
      { value: '', label: t('frontDesk.allRoomLocks') },
      { value: 'locked', label: t('frontDesk.roomLocked') },
      { value: 'unlocked', label: t('frontDesk.roomUnlocked') },
    ],
    floor: [{ value: '', label: t('frontDesk.allFloors') }, ...floors.map((floor) => ({ value: String(floor), label: t('frontDesk.floorNumber', { floor }) }))],
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={active ? t('frontDesk.filtersApplied', { count: active }) : t('frontDesk.filters')}
        className={cn(iconButton('light'), 'relative sm:w-auto sm:gap-2 sm:px-4')}
      >
        <AdjustmentsHorizontalIcon className="size-5" aria-hidden="true" />
        <span className="hidden text-sm font-medium sm:inline">{t('frontDesk.filters')}</span>
        {active ? (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground"
          >
            {active}
          </span>
        ) : null}
      </button>

      <Modal open={open} onClose={close} title={t('frontDesk.filters')}>
        <div className="grid gap-6">
          <div role="group" aria-labelledby="front-desk-filter-nights">
            <h3 id="front-desk-filter-nights" className="text-sm font-medium">
              {t('frontDesk.nightsShown')}
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {WINDOW_OPTIONS.map((option) => (
                <Link
                  key={option}
                  href={frontDeskHref({ from, days: option, type })}
                  onClick={close}
                  aria-current={option === days ? 'page' : undefined}
                  className={pill(option === days ? 'primary' : 'secondary', 'w-full')}
                >
                  {lNights(option, locale)}
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
                {isCustom
                  ? `${lDateShort(from, locale)} – ${lDateShort(addIsoDays(from, days - 1), locale)}`
                  : t('frontDesk.custom')}
              </button>
            </div>
          </div>

          <div role="group" aria-labelledby="front-desk-filter-type">
            <h3 id="front-desk-filter-type" className="text-sm font-medium">
              {t('frontDesk.roomType')}
            </h3>
            <div className="mt-2">
              <RoomTypeSelect id="front-desk-room-type-mobile" options={roomTypes} value={type} from={from} days={days} />
            </div>
          </div>

          <div role="group" aria-labelledby="front-desk-filter-reservation">
            <h3 id="front-desk-filter-reservation" className="text-sm font-medium">{t('frontDesk.reservation')}</h3>
            <div className="mt-2"><RackSelect id="front-desk-filter-reservation-select" items={fieldItems.status} value={rackFilters.status} onValueChange={(value) => updateRack('status', value)} /></div>
          </div>

          <div role="group" aria-labelledby="front-desk-filter-source">
            <h3 id="front-desk-filter-source" className="text-sm font-medium">{t('frontDesk.source')}</h3>
            <div className="mt-2"><RackSelect id="front-desk-filter-source-select" items={fieldItems.source} value={rackFilters.source} onValueChange={(value) => updateRack('source', value)} /></div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div role="group" aria-labelledby="front-desk-filter-room-lock">
              <h3 id="front-desk-filter-room-lock" className="text-sm font-medium">{t('frontDesk.roomLock')}</h3>
              <div className="mt-2"><RackSelect id="front-desk-filter-room-lock-select" items={fieldItems.roomLock} value={rackFilters.roomLock} onValueChange={(value) => updateRack('roomLock', value)} /></div>
            </div>
            <div role="group" aria-labelledby="front-desk-filter-floor">
              <h3 id="front-desk-filter-floor" className="text-sm font-medium">{t('frontDesk.floor')}</h3>
              <div className="mt-2"><RackSelect id="front-desk-filter-floor-select" items={fieldItems.floor} value={rackFilters.floor} onValueChange={(value) => updateRack('floor', value)} /></div>
            </div>
          </div>

          <div role="group" aria-labelledby="front-desk-filter-key">
            <h3 id="front-desk-filter-key" className="text-sm font-medium">
              {t('frontDesk.colourKey')}
            </h3>
            <div className="mt-3">
              <FrontDeskLegend />
            </div>
          </div>

          <div className="flex gap-2 border-t border-border pt-4">
            {active ? (
              <button type="button" onClick={() => { onRackFiltersChange({ status: '', source: '', roomLock: '', floor: '' }); close(); }} className={pill('secondary', 'flex-1')}>
                {t('frontDesk.reset')}
              </button>
            ) : null}
            <button type="button" onClick={close} className={pill('primary', 'flex-1')}>
              {t('frontDesk.done')}
            </button>
          </div>
        </div>
      </Modal>

      <FrontDeskDateFilter from={from} days={days} type={type} open={datesOpen} onOpenChange={setDatesOpen} showTrigger={false} />
    </>
  );
}

function RackSelect({ id, items, value, onValueChange }: { id: string; items: { value: string; label: string }[]; value: string; onValueChange: (value: string) => void }) {
  return (
    <Select items={items} value={value} onValueChange={(next) => onValueChange(next ?? '')}>
      <SelectTrigger id={id} className="w-full justify-between rounded-2xl border-border bg-card py-0"><SelectValue /></SelectTrigger>
      <SelectContent className="rounded-2xl border border-border bg-card p-1.5 shadow-soft ring-0">
        {items.map((item) => <SelectItem key={item.value} value={item.value} className="rounded-xl py-2 pl-2.5 text-sm data-highlighted:bg-stone">{item.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
