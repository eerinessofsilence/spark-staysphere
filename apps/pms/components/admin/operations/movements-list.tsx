import type { ReactNode } from 'react';
import Link from 'next/link';
import { Bed, SignIn, SignOut } from '@phosphor-icons/react/dist/ssr';
import type { Booking } from '@/lib/domain/schemas';
import type { AdminT } from '@/lib/i18n/admin/translate';
import { stayStateKey } from '@/lib/i18n/admin/stay-state';
import { lDateShort } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/locale';
import { cn } from '@/lib/utils';

/** A guest and the room/reference/date line under their name, one row of an arrivals, departures or in-house lane. */
export function Movements({
  title,
  detail,
  bookings,
  dates,
  roomNames,
  t,
  locale,
  empty,
  limit,
  action,
  count,
  showDates,
  columns = 1,
  kind,
  hideHeader,
}: {
  title: string;
  /** Which door this lane is: sets the mark at each row's start — the same glyphs as `BookingStatusBadge`, coloured once the move has happened. */
  kind: 'arrival' | 'departure' | 'inHouse';
  /** The figure beside the heading — today's count, even when the list falls back to what is next. */
  count?: number;
  /** One muted line under the heading — the head count in house, say. */
  detail?: string;
  /** With `action` taking the row's end, put the date on the subline instead. */
  showDates?: boolean;
  bookings: Booking[];
  dates: string[];
  roomNames: Map<string, string>;
  t: AdminT;
  locale: Locale;
  empty?: string;
  /** Show at most this many; the rest fold into one "+N" line. */
  limit?: number;
  /** Rendered at the row's end instead of its date — the desk's move for that stay. */
  action?: (booking: Booking) => ReactNode;
  /** Lay the rows out in this many columns from `sm` up — for a lane that has the card's full width. */
  columns?: 1 | 2;
  /** Drop the `title · count` heading — for a caller whose own tab already says which lane this is. */
  hideHeader?: boolean;
}): ReactNode {
  const listClass = columns === 2 ? 'mt-3 grid gap-1.5 sm:grid-cols-2' : 'mt-3 grid gap-1.5';
  const shown = limit ? bookings.slice(0, limit) : bookings;
  // Coloured once the move has happened — a guest who has come through the
  // door — and muted while it is still due, so a lane reads at a glance.
  const mark = (booking: Booking): { Icon: typeof SignIn; tone: string; label: string } => {
    if (kind === 'inHouse') return { Icon: Bed, tone: 'bg-status-in-house/10 text-status-in-house', label: t('dashboard.inHouse') };
    if (kind === 'arrival') {
      return booking.stayState === 'checked_in' || booking.stayState === 'checked_out'
        ? { Icon: SignIn, tone: 'bg-status-in-house/10 text-status-in-house', label: t(stayStateKey('checked_in')) }
        : { Icon: SignIn, tone: 'bg-status-due-in/10 text-status-due-in', label: t('dashboard.arriving') };
    }
    return booking.stayState === 'checked_out'
      ? { Icon: SignOut, tone: 'bg-status-checked-out/10 text-status-checked-out', label: t(stayStateKey('checked_out')) }
      : { Icon: SignOut, tone: 'bg-status-due-out/10 text-status-due-out', label: t('dashboard.leaving') };
  };
  return (
    <div className="min-w-0 py-4 first:pt-0 last:pb-0 sm:px-5 sm:py-0 sm:first:pl-0 sm:last:pr-0">
      {hideHeader ? null : (
        <h4 className="text-sm font-medium">
          {title} <span className="text-muted-foreground">· {count ?? bookings.length}</span>
        </h4>
      )}
      {detail ? <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p> : null}
      {bookings.length === 0 ? (
        <p className={cn('text-sm text-muted-foreground', hideHeader ? 'mt-0' : 'mt-2')}>{empty ?? t('dashboard.noneThisWeek')}</p>
      ) : (
        <ul className={cn(listClass, hideHeader && 'mt-0')}>
          {shown.map((booking, index) => (
            <li
              key={booking.id}
              data-search={`${booking.guest.firstName} ${booking.guest.lastName} ${roomNames.get(booking.roomTypeId) ?? ''} ${booking.reference}`.toLowerCase()}
              className="flex min-w-0 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm odd:bg-stone/70 even:bg-stone/30"
            >
              {(() => {
                const { Icon, tone, label } = mark(booking);
                return (
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-full', tone)}>
                    <Icon weight="fill" className="size-4" aria-hidden="true" />
                    <span className="sr-only">{label}</span>
                  </span>
                );
              })()}
              <span className="min-w-0 flex-1">
                <Link
                  href={`/admin/bookings/${booking.reference}`}
                  className="block truncate font-medium hover:text-accent-strong"
                >
                  {booking.guest.firstName} {booking.guest.lastName}
                </Link>
                <span className="block truncate text-xs text-muted-foreground">
                  {roomNames.get(booking.roomTypeId) ?? booking.roomTypeId} · {booking.reference}
                  {action && showDates ? ` · ${lDateShort(dates[index]!, locale)}` : ''}
                </span>
              </span>
              {action ? (
                <span className="shrink-0">{action(booking)}</span>
              ) : (
                <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                  {lDateShort(dates[index]!, locale)}
                </span>
              )}
            </li>
          ))}
          {bookings.length > shown.length ? (
            <li className="px-3 py-1.5 text-xs text-muted-foreground">+{bookings.length - shown.length}</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
