import Link from 'next/link';
import { EyeSlash } from '@phosphor-icons/react/dist/ssr';
import type { RoomStatus, RoomType } from '@/lib/domain/schemas';
import type { AdminLocale } from '@/lib/i18n/admin/locale';
import { lDateShort } from '@/lib/i18n/format';
import type { AdminT } from '@/lib/i18n/admin/translate';
import { tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { RoomStatusControl } from '@/components/admin/room-controls';

/**
 * A room type's own row: its name, whether it's hidden, its manual override,
 * and how many are left each night. The overview links the whole row into
 * that room's own detail page (`/admin/rates/[id]`, its rate plans and their
 * inline price forms); the detail page links the name back to the CMS
 * instead and isn't itself a link — see `linkTo`.
 */
export function RoomQuotaRow({
  room,
  override,
  remaining,
  dates,
  columns,
  locale,
  t,
  linkTo,
}: {
  room: RoomType;
  override: RoomStatus | null;
  remaining: Map<string, number>;
  dates: string[];
  columns: string;
  locale: AdminLocale;
  t: AdminT;
  /** Present: the room name stretches to cover the whole row, into this href. Absent: the name links to the room's own CMS page instead. */
  linkTo?: string;
}) {
  return (
    // `relative` unconditionally, not only when `linkTo` needs it to anchor
    // the stretched link: every date cell's `sr-only` span is `position:
    // absolute` too, and with no positioned ancestor at all it resolves
    // against the initial containing block instead of this row — invisible,
    // but its layout box still inflates `documentElement.scrollWidth` by
    // the row's full unclipped width.
    <div className="relative grid items-center border-b border-border bg-stone/40" style={{ gridTemplateColumns: columns }}>
      <div className="sticky left-0 z-20 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 bg-stone/40 px-4 py-2.5">
        {linkTo ? (
          <Link href={linkTo} className="min-w-0 truncate font-medium before:absolute before:inset-0 hover:text-accent-strong">
            {room.name}
          </Link>
        ) : (
          <Link href={`/admin/content/rooms/${room.id}`} className="min-w-0 truncate font-medium hover:text-accent-strong">
            {room.name}
          </Link>
        )}
        {room.hidden ? (
          <span className={tag('py-0.5')}>
            <EyeSlash weight="fill" className="size-3.5" aria-hidden="true" />
            {t('rates.hidden')}
          </span>
        ) : null}
        <span className="relative z-10 ml-auto">
          <RoomStatusControl roomTypeId={room.id} roomName={room.name} value={override ?? 'auto'} />
        </span>
      </div>
      {dates.map((date) => {
        const left = remaining.get(date);
        const day = lDateShort(date, locale);
        const spoken =
          left === undefined
            ? t('rates.nightNoData', { date: day })
            : left === 0
              ? t('rates.nightFullyBooked', { date: day })
              : t('rates.nightLeft', { date: day, count: left });
        return (
          <div key={date} className="border-l border-border py-1.5 text-center">
            <span
              className={cn(
                'inline-block min-w-8 rounded-full px-1.5 py-0.5 text-center text-xs font-medium tabular-nums',
                left === 0 ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success',
              )}
            >
              <span aria-hidden="true">{left === undefined ? '—' : left}</span>
              <span className="sr-only">{spoken}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
