'use client';

import type * as React from 'react';

import { CheckCircle, Clock, SignIn, SignOut, UserMinus, XCircle } from '@phosphor-icons/react/dist/ssr';
import type { Booking, StayState } from '@/lib/domain/schemas';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { stayStateKey } from '@/lib/i18n/admin/stay-state';
import { lBookingStatus } from '@/lib/i18n/format';
import { statusBadge } from '@/lib/ui';
import { cn } from '@/lib/utils';

const statusStyles: Record<Booking['status'], string> = {
  confirmed: 'text-status-confirmed',
  held: 'text-status-offer',
  draft: 'text-status-new',
  cancelled: 'text-status-neutral',
};

const statusIcons: Record<Booking['status'], typeof CheckCircle> = {
  confirmed: CheckCircle,
  held: Clock,
  draft: Clock,
  cancelled: XCircle,
};

// Same status hues as the board's bars; labels stay neutral in both themes.
const stayStyles: Record<Exclude<StayState, 'booked'>, string> = {
  checked_in: 'text-status-in-house',
  checked_out: 'text-status-checked-out',
  no_show: 'text-status-no-show',
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
  trailing,
}: {
  status: Booking['status'];
  stayState?: StayState;
  className?: string;
  /** Drawn inside the pill after the words — the chevron of a badge that is also a menu. */
  trailing?: React.ReactNode;
}) {
  const locale = useAdminLocale();
  const t = useAdminT();
  const stay = status !== 'cancelled' && stayState && stayState !== 'booked' ? stayState : null;
  const Icon = stay ? stayIcons[stay] : statusIcons[status];
  return (
    <span
      className={statusBadge(className)}
    >
      <Icon weight="fill" className={cn('size-4 shrink-0', stay ? stayStyles[stay] : statusStyles[status])} aria-hidden="true" />
      {stay ? t(stayStateKey(stay)) : lBookingStatus(status, locale)}
      {trailing}
    </span>
  );
}
