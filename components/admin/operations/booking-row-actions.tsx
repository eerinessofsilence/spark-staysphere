'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu } from '@base-ui/react/menu';
import { ArrowPathIcon, EllipsisHorizontalIcon, PencilSquareIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { cancelBookingAction } from '@/app/admin/bookings/actions';
import { Modal } from '@/components/site/modal';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';
import { toast } from '@/components/admin/shell/toast';
import { cn } from '@/lib/utils';

export const menuItemClass =
  'flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none select-none data-highlighted:bg-stone data-disabled:cursor-not-allowed data-disabled:opacity-60';

/**
 * The one question before a cancellation, wherever it is asked from — the
 * reservations list's "⋯", the front desk's stay card. Owns the request and
 * its outcome; the caller only opens and closes it.
 */
export function CancelBookingDialog({ reference, open, onClose }: { reference: string; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const t = useAdminT();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');
  const close = React.useCallback(() => {
    setError('');
    onClose();
  }, [onClose]);
  // The question keeps its placeholder so the reference can be set in bold in the middle of it.
  const [questionBefore, questionAfter] = t('ops.cancelConfirmQuestion').split('{reference}');

  const cancel = async () => {
    setPending(true);
    setError('');
    const result = await cancelBookingAction(reference);
    setPending(false);
    if (result.ok) {
      close();
      toast.success(result.message);
      router.refresh();
    } else {
      setError(result.message);
      toast.error(result.message);
    }
  };

  return (
    <Modal open={open} onClose={close} title={t('ops.cancelBooking')}>
      <p className="text-sm">
        {questionBefore}
        <span className="font-semibold">{reference}</span>
        {questionAfter} {t('ops.cancelConfirmBody')}
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={cancel} disabled={pending} className={pill('primary')}>
          {pending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
          {t('ops.cancelConfirmYes')}
        </button>
        <button type="button" onClick={close} className={pill('secondary')}>
          {t('ops.keepBooking')}
        </button>
      </div>
    </Modal>
  );
}

/**
 * A reservation row's actions behind one "⋯", the same shape as a content
 * row's (`RowActions`). Edit opens the booking's own page — there is no
 * separate edit form, so the record itself is the editor. Cancelling is the
 * only change to the booking itself the backend supports; the desk's
 * check-in / check-out live on the stay's badge (`StayStateMenu`), not here.
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
  const t = useAdminT();
  const [confirming, setConfirming] = React.useState(false);
  const close = React.useCallback(() => setConfirming(false), []);

  return (
    <>
      <Menu.Root modal={false}>
        <Menu.Trigger
          openOnHover
          delay={80}
          closeDelay={150}
          aria-label={t('ops.rowActions', { reference })}
          className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-stone hover:text-foreground data-popup-open:bg-stone data-popup-open:text-foreground"
        >
          <EllipsisHorizontalIcon className="size-5" aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50 outline-none">
            <Menu.Popup className="min-w-48 rounded-2xl border border-border bg-card p-1.5 text-foreground shadow-soft outline-none">
              <Menu.LinkItem render={<Link href={`/admin/bookings/${reference}`} />} closeOnClick className={menuItemClass}>
                <PencilSquareIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {t('ops.edit')}
              </Menu.LinkItem>
              <Menu.Item
                disabled={!canCancel}
                onClick={() => setConfirming(true)}
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

      <CancelBookingDialog reference={reference} open={confirming} onClose={close} />
    </>
  );
}
