'use client';

import type * as React from 'react';
import Link from 'next/link';
import { ArrowRightIcon, UsersIcon } from '@heroicons/react/24/outline';
import { Bed, Ruler } from '@phosphor-icons/react/dist/ssr';
import { RoomFactTags, type RoomFacts } from '@/components/rooms/room-facts';
import type { RoomStatus, SpinnerHotspot } from '@/lib/domain/schemas';
import { useLocale, useT } from '@/lib/i18n/context';
import { lBed, lMoney, lStatusText } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';

interface HotspotContentProps {
  hotspot: SpinnerHotspot;
  /** Set when the hotspot sells a room type; a place (the cove) has none. */
  facts?: RoomFacts;
  /** The hotspot's link with the guest's stay already carried along. */
  href: string;
}

function Availability({ status, remaining, className }: { status: RoomStatus; remaining?: number; className?: string }) {
  const { locale } = useLocale();
  const soldOut = status === 'sold_out';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        soldOut ? 'bg-stone text-muted-foreground' : 'bg-[#E8F3EC] text-[#1F6B41]',
        className,
      )}
    >
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', soldOut ? 'bg-muted-foreground' : 'bg-[#2F9E63]')} />
      {lStatusText(status, remaining ?? 0, locale)}
    </span>
  );
}

/**
 * The desk's card beside a pressed or hovered storey. The whole card is the
 * link, its call to action inside it.
 */
export function SpinnerRoomCard({
  hotspot,
  facts,
  href,
  cardRef,
  style,
  onHover,
}: HotspotContentProps & {
  cardRef: React.Ref<HTMLAnchorElement>;
  style: React.CSSProperties | undefined;
  onHover: () => void;
}) {
  const t = useT();
  const { locale } = useLocale();
  return (
    <Link
      ref={cardRef}
      href={href}
      aria-live="polite"
      style={style}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseEnter={onHover}
      // No leave handler: the card opens under the pointer that summoned it, and
      // the browser answers that by sending it a leave the instant it mounts —
      // which shut the topmost storey's card again before it could be read. The
      // stage resolves the hover on every move anyway, and clears it on the way
      // out, so there is nothing here left to close.
      className="glass absolute z-30 block w-[min(20rem,calc(100%-2rem))] overflow-hidden rounded-3xl text-foreground shadow-soft-lg"
    >
      {facts?.photo ? (
        <img src={facts.photo.url} alt="" width={640} height={360} decoding="async" className="h-36 w-full object-cover" />
      ) : null}
      <div className="p-4">
        {facts?.status ? <Availability status={facts.status} remaining={facts.remaining} /> : null}
        <p className="mt-2 font-medium">
          {facts ? `${facts.name} — ${lMoney(facts.nightlyPrice, facts.currency, locale)}` : hotspot.label}
          {facts ? <span className="text-sm font-normal text-muted-foreground"> {t('rooms.aNight')}</span> : null}
        </p>
        {facts ? (
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Ruler weight="fill" className="size-4" aria-hidden="true" />
              {facts.areaM2} m²
            </li>
            <li className="flex items-center gap-2">
              <Bed weight="fill" className="size-4" aria-hidden="true" />
              {lBed(facts.bedType, locale)}
            </li>
            <li className="flex items-center gap-2">
              <UsersIcon className="size-4" aria-hidden="true" />
              {t('rooms.sleepsCount', { n: String(facts.capacity) })}
            </li>
          </ul>
        ) : (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{hotspot.description}</p>
        )}
        <span className={pill('primary', 'mt-3 h-10 w-full px-4')}>
          {hotspot.cta}
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

/**
 * The phone's version of the card, inside the product's own sheet. There is no
 * room for a card floating beside a storey when the stage is the whole screen,
 * and a sheet has room for the prose the card had to drop.
 */
export function SpinnerRoomSheetBody({ hotspot, facts, href }: HotspotContentProps) {
  const t = useT();
  const { locale } = useLocale();
  return (
    <div className="flex flex-col">
      {facts?.photo ? (
        <img
          src={facts.photo.url}
          alt=""
          width={facts.photo.width}
          height={facts.photo.height}
          className="aspect-[3/2] w-full rounded-[14px] object-cover"
        />
      ) : null}

      {facts?.status ? <Availability status={facts.status} remaining={facts.remaining} className="mt-5 w-fit" /> : null}

      {/* No heading here: the sheet's own bar already names the room, and
          saying it twice reads as a mistake. The price is what the guest came
          to this sheet for, so it takes the display size. */}
      {facts ? (
        <p className="mt-3 flex items-baseline gap-1.5">
          <span className="text-display text-3xl">{lMoney(facts.nightlyPrice, facts.currency, locale)}</span>
          <span className="text-sm text-muted-foreground">{t('rooms.aNight')}</span>
        </p>
      ) : null}

      <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{hotspot.description}</p>

      {facts ? <RoomFactTags facts={facts} className="mt-4" /> : null}

      <Link href={href} className={pill('primary', 'mt-6 min-h-12 w-full justify-center')}>
        {hotspot.cta}
        <ArrowRightIcon className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
