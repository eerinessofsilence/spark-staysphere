'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu } from '@base-ui/react/menu';
import { ArrowTopRightOnSquareIcon, ChevronDownIcon, DocumentTextIcon, TableCellsIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { InvoiceModal, type InvoiceData } from '@/components/booking/invoice-modal';
import { useAdminT } from '@/lib/i18n/admin/context';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { CancelBookingDialog, menuItemClass } from './booking-row-actions';

/**
 * The booking detail page's own header action: one "Actions" pill, the same
 * shape every other detail page's header button uses, opening onto the
 * record's moves — jump to the front desk, open the guest's own
 * confirmation page, and (below a rule, since it is the one destructive one)
 * cancel. Shares its confirm dialog and item styling with the reservations
 * list's own "⋯" (`BookingRowActions`) rather than asking twice.
 */
export function BookingHeaderActions({
  reference,
  checkIn,
  canCancel,
  cancelBlockedReason,
  invoice,
  guestConfirmationUrl,
}: {
  reference: string;
  checkIn: string;
  canCancel: boolean;
  /** Why cancelling is unavailable — shown under the disabled item. */
  cancelBlockedReason?: string;
  /** The same shape the guest's own "View invoice" builds — see `InvoiceModal`. */
  invoice: InvoiceData;
  guestConfirmationUrl: string | null;
}) {
  const t = useAdminT();
  const [confirming, setConfirming] = React.useState(false);
  const close = React.useCallback(() => setConfirming(false), []);
  const [invoiceOpen, setInvoiceOpen] = React.useState(false);

  return (
    <>
      <Menu.Root modal={false}>
        <Menu.Trigger className={pill('secondary')}>
          {t('ops.thActions')}
          <ChevronDownIcon className="size-4" aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50 outline-none">
            <Menu.Popup className="min-w-56 rounded-2xl border border-border bg-card p-1.5 text-foreground shadow-soft outline-none">
              <Menu.LinkItem
                render={<Link href={`/admin/front-desk?from=${checkIn}`} />}
                closeOnClick
                className={menuItemClass}
              >
                <TableCellsIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {t('booking.showOnFrontDesk')}
              </Menu.LinkItem>
              {guestConfirmationUrl ? (
                <Menu.LinkItem
                  render={<a href={guestConfirmationUrl} target="_blank" rel="noreferrer" />}
                  closeOnClick
                  className={menuItemClass}
                >
                  <ArrowTopRightOnSquareIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {t('ops.guestConfirmationPage')}
                </Menu.LinkItem>
              ) : null}
              <Menu.Item onClick={() => setInvoiceOpen(true)} className={menuItemClass}>
                <DocumentTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {t('booking.issueInvoice')}
              </Menu.Item>
              <Menu.Separator className="my-1.5 h-px bg-border" />
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
      <InvoiceModal invoice={invoice} open={invoiceOpen} onClose={() => setInvoiceOpen(false)} />
    </>
  );
}
