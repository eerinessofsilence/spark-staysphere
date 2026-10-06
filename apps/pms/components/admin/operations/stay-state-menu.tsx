'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Menu } from '@base-ui/react/menu';
import { ArrowPathIcon, ChevronDownIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { setStayStateAction } from '@/app/admin/bookings/actions';
import type { Booking, StayState } from '@/lib/domain/schemas';
import { STAY_TRANSITIONS } from '@/lib/domain/stay-state';
import { useAdminT } from '@/lib/i18n/admin/context';
import { stayMoveKey } from '@/lib/i18n/admin/stay-state';
import { toast } from '@/components/admin/shell/toast';
import { cn } from '@/lib/utils';
import { BookingStatusBadge } from './booking-status-badge';
import { CancelBookingDialog, menuItemClass } from './booking-row-actions';

/**
 * The stay's badge as a control: press it and the moves the desk can make
 * from here are listed — check in, check out, no-show, one step back — and,
 * below a rule, cancelling the booking itself, which is a different thing
 * and asks first. A cancelled booking has no moves, so its badge is just a
 * badge. The list is `STAY_TRANSITIONS`'s, never a full list with most of it
 * greyed out: a desk reads three verbs faster than five states.
 */
export function StayStateMenu({
  reference,
  status,
  stayState,
  canCancel,
  cancelBlockedReason,
  onChanged,
  size = 'default',
  showLabel = false,
}: {
  reference: string;
  status: Booking['status'];
  stayState: StayState;
  canCancel: boolean;
  cancelBlockedReason?: string;
  /** The new state once the server has it — so a card holding its own copy of the stay can follow. */
  onChanged?: (state: StayState) => void;
  /**
   * `large` is the booking page's own: the status as a full-height button,
   * as prominent as the page's other actions, because moving a stay is the
   * one thing the desk opens that page to do. The default is the badge with
   * a chevron the lists use.
   */
  size?: 'default' | 'large';
  /** Use on a booking detail card, where the control should state its purpose as well as its current value. */
  showLabel?: boolean;
}) {
  const router = useRouter();
  const t = useAdminT();
  const [pending, setPending] = React.useState(false);
  const [confirmingCancel, setConfirmingCancel] = React.useState(false);
  const closeCancel = React.useCallback(() => setConfirmingCancel(false), []);

  if (status === 'cancelled') return <BookingStatusBadge status={status} className={size === 'large' ? 'min-h-11 px-5 text-sm' : undefined} />;
  const large = size === 'large';

  const move = async (state: StayState) => {
    setPending(true);
    const result = await setStayStateAction(reference, state);
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      onChanged?.(state);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  };

  return (
    <>
      <Menu.Root modal={false}>
        <Menu.Trigger
          disabled={pending}
          aria-label={t('stay.change')}
          className={cn(
            'inline-flex cursor-pointer items-center rounded-full outline-none transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-60',
            showLabel && 'gap-2 border border-border bg-card px-2.5 py-1.5 text-sm font-medium shadow-soft',
          )}
        >
          {showLabel ? <span>{t('stay.change')}</span> : null}
          <BookingStatusBadge
            status={status}
            stayState={stayState}
            className={large ? 'min-h-11 gap-2 px-5 text-sm shadow-soft' : undefined}
            trailing={
              pending ? (
                <ArrowPathIcon className={cn('animate-spin opacity-70', large ? 'size-4' : 'size-3.5')} aria-hidden="true" />
              ) : (
                <ChevronDownIcon className={cn('opacity-70', large ? 'size-4' : 'size-3.5')} aria-hidden="true" />
              )
            }
          />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-[60] outline-none">
            <Menu.Popup className="min-w-52 rounded-2xl border border-border bg-card p-1.5 text-foreground shadow-soft outline-none">
              {STAY_TRANSITIONS[stayState].map((next) => (
                <Menu.Item key={next} onClick={() => move(next)} className={menuItemClass}>
                  {t(stayMoveKey(stayState, next))}
                </Menu.Item>
              ))}
              <Menu.Separator className="my-1.5 h-px bg-border" />
              <Menu.Item
                disabled={!canCancel}
                onClick={() => setConfirmingCancel(true)}
                className={cn(menuItemClass, canCancel && 'text-danger data-highlighted:bg-danger/10')}
              >
                <XCircleIcon className="size-4 shrink-0" aria-hidden="true" />
                <span className="flex flex-col py-2 text-left">
                  {t('ops.cancelBooking')}
                  {!canCancel && cancelBlockedReason ? (
                    <span className="text-xs text-muted-foreground">{cancelBlockedReason}</span>
                  ) : null}
                </span>
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <CancelBookingDialog reference={reference} open={confirmingCancel} onClose={closeCancel} />
    </>
  );
}
