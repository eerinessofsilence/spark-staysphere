'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu } from '@base-ui/react/menu';
import {
  ArrowDownTrayIcon,
  CreditCardIcon,
  EllipsisHorizontalIcon,
  EnvelopeIcon,
  PencilSquareIcon,
  PrinterIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { CancelBookingDialog, menuItemClass } from '@/components/admin/operations/booking-row-actions';
import { useAdminT } from '@/lib/i18n/admin/context';
import { cn } from '@/lib/utils';

export function InvoiceRowActions({ reference, canCancel }: { reference: string; canCancel: boolean }) {
  const t = useAdminT();
  const [confirming, setConfirming] = React.useState(false);
  const invoiceHref = `/admin/accounting/invoices?invoice=${encodeURIComponent(reference)}`;
  const paymentHref = `/admin/accounting?q=${encodeURIComponent(reference)}`;

  return <>
    <Menu.Root modal={false}>
      <Menu.Trigger
        aria-label={t('accounting.invoiceActions', { reference })}
        className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-stone hover:text-foreground data-popup-open:bg-stone data-popup-open:text-foreground"
      >
        <EllipsisHorizontalIcon className="size-5" aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50 outline-none">
          <Menu.Popup className="min-w-56 rounded-2xl border border-border bg-card p-1.5 text-foreground shadow-soft outline-none">
            <Menu.LinkItem render={<Link href={invoiceHref} scroll={false} />} closeOnClick className={menuItemClass}>
              <ArrowDownTrayIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />{t('accounting.downloadInvoice')}
            </Menu.LinkItem>
            <Menu.Item disabled={!canCancel} onClick={() => setConfirming(true)} className={cn(menuItemClass, canCancel && 'text-danger data-highlighted:bg-danger/10')}>
              <XCircleIcon className="size-4 shrink-0" aria-hidden="true" />{t('ops.cancelBooking')}
            </Menu.Item>
            <Menu.LinkItem render={<Link href={paymentHref} scroll={false} />} closeOnClick className={menuItemClass}>
              <CreditCardIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />{t('accounting.addPayment')}
            </Menu.LinkItem>
            <Menu.LinkItem render={<Link href={`/admin/bookings/${encodeURIComponent(reference)}`} />} closeOnClick className={menuItemClass}>
              <PencilSquareIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />{t('accounting.correctInvoice')}
            </Menu.LinkItem>
            <Menu.Item disabled className={cn(menuItemClass, 'cursor-not-allowed')}>
              <EnvelopeIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="flex flex-col py-1 text-left">{t('accounting.sendInvoice')}<span className="text-xs text-muted-foreground">{t('accounting.invoiceEmailDemo')}</span></span>
            </Menu.Item>
            <Menu.LinkItem render={<Link href={invoiceHref} scroll={false} />} closeOnClick className={menuItemClass}>
              <PrinterIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />{t('accounting.renderInvoice')}
            </Menu.LinkItem>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
    <CancelBookingDialog reference={reference} open={confirming} onClose={() => setConfirming(false)} />
  </>;
}
