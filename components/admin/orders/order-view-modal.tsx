'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import type { HotelOrder, OrderCategory } from '@/lib/domain/orders';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { lDateShort, lMoney } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
import { Modal } from '@/components/site/modal';
import { OrderStatusMenu } from './order-status-menu';

const categoryKeys: Record<OrderCategory, AdminTranslationKey> = {
  dining: 'orders.categoryDining',
  wellness: 'orders.categoryWellness',
  experience: 'orders.categoryExperience',
  transport: 'orders.categoryTransport',
  room: 'orders.categoryRoom',
};

function deliveryLabel(t: ReturnType<typeof useAdminT>, delivery: string): string {
  if (delivery === 'Room delivery') return t('orders.roomDelivery');
  if (delivery === 'Hotel pickup') return t('orders.hotelPickup');
  return t('orders.withoutDelivery');
}

export function OrderViewButton({ order }: { order: HotelOrder }) {
  const t = useAdminT();
  const [open, setOpen] = React.useState(false);
  const locale = useAdminLocale();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative z-10 text-display text-base hover:text-accent-strong focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        aria-label={`${t('orders.view')}: #${order.id}`}
      >
        #{order.id}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`${t('orders.view')} #${order.id}`} className="sm:max-w-2xl">
        <div className="grid gap-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
            <div>
              <p className="text-display text-2xl">{order.serviceName}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t(categoryKeys[order.category])}</p>
            </div>
            <OrderStatusMenu orderId={order.id} status={order.status} />
          </div>

          <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <Detail label={t('orders.fieldGuest')} value={order.guestName} />
            <Detail label={t('orders.fieldRoom')} value={order.roomNumber ?? '—'} />
            <Detail label={t('orders.fieldDelivery')} value={deliveryLabel(t, order.delivery)} />
            <Detail label={t('orders.fieldDue')} value={`${lDateShort(order.dueAt.slice(0, 10), locale)} · ${format(new Date(order.dueAt), 'HH:mm')}`} />
            <Detail label={t('orders.fieldTotal')} value={lMoney(order.total, order.currency, locale)} />
            <Detail label={t('orders.fieldExtras')} value={String(order.extras)} />
            <Detail label={t('orders.fieldPayment')} value={order.paymentStatus === 'paid' ? t('orders.paid') : order.paymentStatus === 'partial' ? t('orders.partial') : t('orders.unpaid')} />
            <Detail label={t('orders.created')} value={`${lDateShort(order.createdAt.slice(0, 10), locale)} · ${format(new Date(order.createdAt), 'HH:mm')}`} />
          </dl>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
            <div>
              <p className="text-xs text-muted-foreground">{t('orders.orderDetails')}</p>
              <p className="mt-1 text-sm">{order.chatCount} {t('orders.thChat').toLowerCase()}</p>
            </div>
            {order.bookingReference ? (
              <a href={`/admin/bookings/${order.bookingReference}`} className={pill('secondary')}>
                <ArrowTopRightOnSquareIcon className="size-4" aria-hidden="true" />
                {t('orders.openBooking')}
              </a>
            ) : <span className="text-sm text-muted-foreground">{t('orders.noBooking')}</span>}
          </div>
        </div>
      </Modal>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}
