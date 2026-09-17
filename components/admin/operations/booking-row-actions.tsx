'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu } from '@base-ui/react/menu';
import { ArrowPathIcon, EllipsisHorizontalIcon, PencilSquareIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { cancelBookingAction } from '@/app/admin/bookings/actions';
import { Modal } from '@/components/site/modal';
import { pill } from '@/lib/ui';
import { toast } from '@/components/admin/shell/toast';
import { cn } from '@/lib/utils';

const itemClass =
  'flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none select-none data-highlighted:bg-stone data-disabled:cursor-not-allowed data-disabled:opacity-60';

/**
 * A reservation row's actions behind one "⋯", the same shape as a content
 * row's (`RowActions`). Edit opens the booking's own page — there is no
 * separate edit form, so the record itself is the editor. The only status
 * change this product's backend actually supports is cancelling a confirmed
 * stay (`BookingService.cancelAsHotel`): there is no "confirm" or "restore"
 * to offer back, so the menu doesn't pretend one exists.
 */
export function BookingRowActions({
  reference,
  canCancel,
  cancelBlockedReason,
}: {
  reference: string;
  canCancel: boolean;
  /** Why cancelling is unavailable — shown under the disabled item, same pattern as a blocked delete. */
  cancelBlockedReason?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');
  const close = React.useCallback(() => {
    setConfirming(false);
    setError('');
  }, []);

  const cancel = async () => {
    setPending(true);
    setError('');
    const result = await cancelBookingAction(reference);
    setPending(false);
    if (result.ok) {
      setConfirming(false);
      toast.success(result.message);
      router.refresh();
    } else {
      setError(result.message);
      toast.error(result.message);
    }
  };

  return (
    <>
      <Menu.Root modal={false}>
        <Menu.Trigger
          openOnHover
          delay={80}
          closeDelay={150}
          aria-label={`Actions for ${reference}`}
          className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-stone hover:text-foreground data-popup-open:bg-stone data-popup-open:text-foreground"
        >
          <EllipsisHorizontalIcon className="size-5" aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50 outline-none">
            <Menu.Popup className="min-w-48 rounded-2xl border border-border bg-card p-1.5 text-foreground shadow-soft outline-none">
              <Menu.LinkItem render={<Link href={`/admin/bookings/${reference}`} />} className={itemClass}>
                <PencilSquareIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                Edit
              </Menu.LinkItem>
              <Menu.Item
                disabled={!canCancel}
                onClick={() => setConfirming(true)}
                className={cn(itemClass, canCancel && 'text-danger data-highlighted:bg-danger/10')}
              >
                <XCircleIcon className="size-4 shrink-0" aria-hidden="true" />
                <span className="flex flex-col py-2 text-left">
                  Cancel booking
                  {!canCancel && cancelBlockedReason ? (
                    <span className="text-xs text-muted-foreground">{cancelBlockedReason}</span>
                  ) : null}
                </span>
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <Modal open={confirming} onClose={close} title="Cancel booking">
        <p className="text-sm">
          Cancel <span className="font-semibold">{reference}</span>? Its nights go back on sale straight
          away. This demo moves no money, so there is no refund to issue.
        </p>
        {error ? (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={cancel} disabled={pending} className={pill('primary')}>
            {pending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
            Yes, cancel booking
          </button>
          <button type="button" onClick={close} className={pill('secondary')}>
            Keep booking
          </button>
        </div>
      </Modal>
    </>
  );
}
