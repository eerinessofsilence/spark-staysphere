import { UsersIcon } from '@heroicons/react/24/outline';
import { Bed, Ruler } from '@phosphor-icons/react/dist/ssr';
import { factTone, tintInk, tintSurface } from '@/components/rooms/feature-icon';
import type { Currency, RoomStatus, RoomType } from '@/lib/domain/schemas';
import { bedLabels } from '@/lib/formatting';
import { tag } from '@/lib/ui';
import { cn } from '@/lib/utils';

/**
 * What a marker on the arrival stage may say about the room type it sells,
 * keyed by slug. Built once by the page from the catalog's offers — the price
 * is the offer's own, never computed here.
 */
export interface RoomFacts {
  name: string;
  areaM2: number;
  floor: number;
  capacity: number;
  bedType: RoomType['bedType'];
  nightlyPrice: number;
  currency: Currency;
  status?: RoomStatus;
  remaining?: number;
  /** The room's cover, so a phone's sheet can show what the marker points at. */
  photo?: { url: string; width?: number; height?: number };
}

/** Size, bed and capacity as the tinted chips a room's sheet shows, one tone per kind of fact. */
export function RoomFactTags({ facts, className }: { facts: RoomFacts; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)}>
      <li className={tag(tintSurface[factTone.area])}>
        <Ruler weight="fill" className={cn('size-3.5', tintInk[factTone.area])} aria-hidden="true" />
        {facts.areaM2} m²
      </li>
      <li className={tag(tintSurface[factTone.bed])}>
        <Bed weight="fill" className={cn('size-3.5', tintInk[factTone.bed])} aria-hidden="true" />
        {bedLabels[facts.bedType]}
      </li>
      <li className={tag(tintSurface[factTone.capacity])}>
        <UsersIcon className={cn('size-3.5', tintInk[factTone.capacity])} aria-hidden="true" />
        Sleeps {facts.capacity}
      </li>
    </ul>
  );
}
