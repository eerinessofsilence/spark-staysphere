'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Menu } from '@base-ui/react/menu';
import { ArrowPathIcon, ChevronDownIcon, EllipsisHorizontalIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { CheckCircle, Clock, Package, SpinnerGap, XCircle } from '@phosphor-icons/react/dist/ssr';
import { setOrderStatusAction } from '@/app/admin/orders/actions';
import type { OrderStatus } from '@/lib/domain/orders';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { useAdminT } from '@/lib/i18n/admin/context';
import { toast } from '@/components/admin/shell/toast';
import { menuItemClass } from '@/components/admin/operations/booking-row-actions';
import { cn } from '@/lib/utils';
import { statusBadge } from '@/lib/ui';

const statusMeta: Record<OrderStatus, { key: AdminTranslationKey; className: string; icon: typeof CheckCircle }> = {
  new: { key: 'orders.statusNew', className: 'text-status-new', icon: Clock },
  confirmed: { key: 'orders.statusConfirmed', className: 'text-status-confirmed', icon: CheckCircle },
  in_progress: { key: 'orders.statusInProgress', className: 'text-status-due-in', icon: SpinnerGap },
  ready: { key: 'orders.statusReady', className: 'text-status-in-house', icon: Package },
  completed: { key: 'orders.statusCompleted', className: 'text-status-checked-out', icon: CheckCircle },
  cancelled: { key: 'orders.statusCancelled', className: 'text-status-neutral', icon: XCircle },
};

export const ORDER_STATUS_OPTIONS: OrderStatus[] = ['new', 'confirmed', 'in_progress', 'ready', 'completed', 'cancelled'];

export function orderStatusLabel(t: (key: AdminTranslationKey) => string, status: OrderStatus): string {
  return t(statusMeta[status].key);
}

export function OrderStatusBadge({ status, trailing }: { status: OrderStatus; trailing?: React.ReactNode }) {
  const t = useAdminT();
  const meta = statusMeta[status];
  const Icon = meta.icon;
  return (
    <span className={statusBadge()}>
      <Icon weight="fill" className={cn('size-4 shrink-0', meta.className)} aria-hidden="true" />
      {t(meta.key)}
      {trailing}
    </span>
  );
}

export function OrderStatusMenu({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const t = useAdminT();
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const change = async (next: OrderStatus) => {
    if (next === status) return;
    setPending(true);
    const result = await setOrderStatusAction({ orderId, status: next });
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  };

  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        disabled={pending}
        aria-label={`${t('orders.changeStatus')}: ${orderId}`}
        className="inline-flex cursor-pointer rounded-full outline-none transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-60"
      >
        <OrderStatusBadge
          status={status}
          trailing={pending ? <ArrowPathIcon className="size-3.5 animate-spin opacity-70" aria-hidden="true" /> : <ChevronDownIcon className="size-3.5 opacity-70" aria-hidden="true" />}
        />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-[60] outline-none">
          <Menu.Popup className="min-w-52 rounded-2xl border border-border bg-card p-1.5 text-foreground shadow-soft outline-none">
            {ORDER_STATUS_OPTIONS.map((next) => (
              <Menu.Item key={next} disabled={next === status} onClick={() => change(next)} className={cn(menuItemClass, next === status && 'bg-stone')}>
                <OrderStatusBadge status={next} />
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function OrderRowActions({ orderId, bookingReference }: { orderId: string; bookingReference: string | null }) {
  const t = useAdminT();
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger aria-label={t('orders.rowActions', { id: orderId })} className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-stone hover:text-foreground data-popup-open:bg-stone data-popup-open:text-foreground">
        <EllipsisHorizontalIcon className="size-5" aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50 outline-none">
          <Menu.Popup className="min-w-48 rounded-2xl border border-border bg-card p-1.5 text-foreground shadow-soft outline-none">
            {bookingReference ? (
              <Menu.LinkItem render={<a href={`/admin/bookings/${bookingReference}`} />} closeOnClick className={menuItemClass}>
                <ArrowTopRightOnSquareIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {t('orders.openBooking')}
              </Menu.LinkItem>
            ) : (
              <Menu.Item disabled className={menuItemClass}>
                {t('orders.demoNote')}
              </Menu.Item>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
