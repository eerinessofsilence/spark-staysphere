'use client';

import Link from 'next/link';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  Bed,
  Buildings,
  CheckCircle,
  Eye,
  Funnel,
  Ruler,
  UsersThree,
  XCircle,
} from '@phosphor-icons/react/dist/ssr';
import type { FloorPlanUnit } from '@/lib/application/inventory-service';
import { buildQuery } from '@/lib/application/search-params';
import type { StayCriteria } from '@/lib/domain/schemas';
import { useLocale, useT } from '@/lib/i18n/context';
import { lBed, lFacade, lFloor, lMoney, lNights, lRoomNumber, lView } from '@/lib/i18n/format';
import { iconButton, pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { factTone, tintInk, tintSurface } from '@/components/rooms/feature-icon';
import { unitStatusWords } from './unit-status';

const badge = {
  available: { icon: CheckCircle, className: 'bg-success/10 text-success' },
  booked: { icon: XCircle, className: 'bg-danger/10 text-danger' },
  unsuitable: { icon: UsersThree, className: 'bg-warning/10 text-warning' },
  filtered: { icon: Funnel, className: 'bg-stone text-muted-foreground' },
} as const;

interface RoomUnitCardProps {
  unit: FloorPlanUnit;
  criteria: StayCriteria;
  onClose: () => void;
  /** Inside the phone sheet the sheet is the container. */
  bare?: boolean;
}

export function RoomUnitCard({ unit, criteria, onClose, bare = false }: RoomUnitCardProps) {
  const t = useT();
  const { locale } = useLocale();
  const guests = criteria.adults + criteria.children;
  const stayQuery = buildQuery({ criteria });
  const roomHref = `/rooms/${unit.roomSlug}?${stayQuery}`;
  const status = badge[unit.status];

  const facts = [
    {
      icon: Buildings,
      label: `${lFloor(unit.floor, locale)}, ${lFacade(unit.facade, locale)}`,
      tone: factTone.floor,
    },
    { icon: Eye, label: lView(unit.view, locale), tone: factTone.view },
    { icon: Ruler, label: `${unit.areaM2} m²`, tone: factTone.area },
    { icon: UsersThree, label: t('rooms.sleepsCount', { n: String(unit.capacity) }), tone: factTone.capacity },
    { icon: Bed, label: lBed(unit.bedType, locale), tone: factTone.bed },
  ];

  const explanation =
    unit.status === 'booked'
      ? t('rooms.explanationBooked', { number: unit.number, room: unit.roomName })
      : unit.status === 'unsuitable'
        ? t('rooms.explanationUnsuitable', {
            room: unit.roomName,
            capacity: String(unit.capacity),
            guests: String(guests),
          })
        : t('rooms.explanationFiltered');

  return (
    <div className={cn(bare ? 'p-5' : 'rounded-[18px] bg-card p-5 shadow-soft sm:p-6')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-display text-3xl">{lRoomNumber(unit.number, locale)}</p>
          <Link href={roomHref} className="mt-1 inline-block text-sm font-medium hover:text-accent-strong">
            {unit.roomName}
          </Link>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('room.closeRoomDetails')}
          className={iconButton('light', 'size-10')}
        >
          <XMarkIcon className="size-4" aria-hidden="true" />
        </button>
      </div>

      <p
        className={cn(
          'mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
          status.className,
        )}
      >
        <status.icon weight="fill" className="size-4 shrink-0" aria-hidden="true" />
        {unitStatusWords(unit, guests, t)}
      </p>

      <ul className="mt-4 flex flex-wrap gap-1.5">
        {facts.map((fact) => (
          <li key={fact.label} className={tag(tintSurface[fact.tone])}>
            <fact.icon weight="fill" className={cn('size-3.5', tintInk[fact.tone])} aria-hidden="true" />
            {fact.label}
          </li>
        ))}
      </ul>

      {unit.price ? (
        <div className="mt-5 border-t border-border pt-4">
          <p>
            <span className="text-display text-2xl">
              {lMoney(unit.price.nightlyPrice, unit.price.currency, locale)}
            </span>
            <span className="text-sm text-muted-foreground"> {t('rooms.aNight')}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {lMoney(unit.price.total, unit.price.currency, locale)}{' '}
            {t('rooms.forNightsTaxesIn', { nights: lNights(unit.price.nights, locale) })}
          </p>
        </div>
      ) : null}

      {unit.status === 'available' ? (
        <div className="mt-5 grid gap-2">
          <Link
            href={`/book/${unit.roomSlug}?${buildQuery({ criteria, roomNumber: unit.number })}`}
            className={pill('primary', 'w-full')}
          >
            {t('rooms.bookRoomNumber', { number: unit.number })}
          </Link>
          <Link href={roomHref} className={pill('secondary', 'w-full')}>
            {t('rooms.seeTheRoom')}
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{explanation}</p>
          <Link href={roomHref} className={pill('secondary', 'mt-4 w-full')}>
            {t('rooms.seeTheRoom')}
          </Link>
        </>
      )}
    </div>
  );
}
