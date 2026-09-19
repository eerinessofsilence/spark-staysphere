'use client';

import { CheckCircle, Clock, SignIn, SignOut, UserMinus, XCircle } from '@phosphor-icons/react/dist/ssr';
import type { Booking, StayState } from '@/lib/domain/schemas';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { stayStateKey } from '@/lib/i18n/admin/stay-state';
import { lBookingStatus } from '@/lib/i18n/format';
import { cn } from '@/lib/utils';

const statusStyles: Record<Booking['status'], string> = {
  confirmed: 'bg-success/10 text-success',
  held: 'bg-warning/10 text-warning',
  draft: 'bg-warning/10 text-warning',
  cancelled: 'bg-stone text-muted-foreground',
};

const statusIcons: Record<Booking['status'], typeof CheckCircle> = {
  confirmed: CheckCircle,
  held: Clock,
  draft: Clock,
  cancelled: XCircle,
};

// Same inks as the board's bars, so "checked in" is the one green everywhere.
const stayStyles: Record<Exclude<StayState, 'booked'>, string> = {
  checked_in: 'bg-stay-in-house/10 text-stay-in-house',
  checked_out: 'bg-stay-checked-out text-stay-checked-out-ink',
  no_show: 'bg-stay-no-show text-stay-no-show-ink',
};

const stayIcons: Record<Exclude<StayState, 'booked'>, typeof CheckCircle> = {
  checked_in: SignIn,
  checked_out: SignOut,
  no_show: UserMinus,
};

/**
 * One badge for both of a booking's states: its commercial status, and —
 * once the desk has done something with a confirmed stay — where the guest
 * is. Cancelled always wins; a stay nobody has touched reads as its status.
 */
export function BookingStatusBadge({
  status,
  stayState,
  className,
}: {
  status: Booking['status'];
  stayState?: StayState;
  className?: string;
}) {
  const locale = useAdminLocale();
  const t = useAdminT();
  const stay = status !== 'cancelled' && stayState && stayState !== 'booked' ? stayState : null;
  const Icon = stay ? stayIcons[stay] : statusIcons[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap',
        stay ? stayStyles[stay] : statusStyles[status],
        className,
      )}
    >
      <Icon weight="fill" className="size-4 shrink-0" aria-hidden="true" />
      {stay ? t(stayStateKey(stay)) : lBookingStatus(status, locale)}
    </span>
  );
}
