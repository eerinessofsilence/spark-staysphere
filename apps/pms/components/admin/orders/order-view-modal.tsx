'use client';

import * as React from 'react';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import type { HotelOrder, OrderCategory } from '@/lib/domain/orders';
import type { AddOn } from '@/lib/domain/schemas';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { lDateShort, lMoney } from '@/lib/i18n/format';
import { pill } from '@/lib/ui';
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

export function OrderViewRow({ children, orderId }: { children: React.ReactNode; orderId: string }) {
  const navigating = React.useRef(false);
  const navigate = () => {
    if (navigating.current) return;
    navigating.current = true;
    window.location.assign(`/admin/orders/${encodeURIComponent(orderId)}`);
  };
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => setReady(true), []);
  return (
      <tr
        tabIndex={ready ? 0 : -1}
        data-order-interactive={ready}
        className="relative cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-stone/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
        onClick={(event) => {
          if (ready && !(event.target as HTMLElement).closest('button, a, input, label, [role="menu"], [role="dialog"]')) navigate();
        }}
        onKeyDown={(event) => {
          if (ready && event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            navigate();
          }
        }}
      >{children}</tr>
  );
}

export function OrderViewButton({ order }: { order: HotelOrder }) {
  const t = useAdminT();
  return <a href={`/admin/orders/${encodeURIComponent(order.id)}`} aria-label={`${t('orders.view')}: #${order.id}`} className="text-display text-base hover:text-accent-strong">#{order.id}</a>;
}

export function OrderDetails({ order, service, booking, createdLabel, dueLabel }: {
  order: HotelOrder;
  service?: AddOn;
  createdLabel: string;
  dueLabel: string;
  booking?: { reference: string; guestName: string; email: string; checkIn: string; checkOut: string } | null;
}) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const copy = locale === 'ru' ? { photo: 'Фото услуги ещё не добавлено в каталог', guest: 'Заказ для гостя', booking: 'Связанная бронь' } : locale === 'de' ? { photo: 'Noch kein Foto im Servicekatalog', guest: 'Bestellung für', booking: 'Verknüpfte Buchung' } : { photo: 'No service photo in the catalog yet', guest: 'Ordered for', booking: 'Linked booking' };

  return (
        <section className="mt-6 grid gap-6 rounded-[18px] bg-card p-5 shadow-soft sm:p-8" aria-label={t('orders.orderDetails')}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              {service?.photos?.[0] ? <img src={service.photos[0].url} alt={order.serviceName} className="aspect-[16/9] w-full rounded-[18px] object-cover" /> : <p className="flex min-h-32 items-center rounded-[18px] bg-stone p-6 text-sm text-muted-foreground">{copy.photo}</p>}
              {service?.description ? <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{service.description}</p> : null}
            </div>
            <div className="min-w-0 self-center">
              <p className="text-sm text-muted-foreground">{copy.guest}</p>
              <p className="text-display mt-2 text-2xl">{booking?.guestName ?? order.guestName}</p>
              {booking ? <>
                <p className="mt-2 break-words text-sm text-muted-foreground">{booking.email}</p>
                <p className="mt-5 text-sm text-muted-foreground">{copy.booking}</p>
                <a href={`/admin/bookings/${booking.reference}`} className="mt-1 inline-block font-semibold underline underline-offset-4">{booking.reference}</a>
                <p className="mt-2 text-sm">{lDateShort(booking.checkIn, locale)} → {lDateShort(booking.checkOut, locale)}</p>
              </> : <p className="mt-4 text-sm text-muted-foreground">{t('orders.noBooking')}</p>}
              <p className="mt-3 text-sm">{t('orders.fieldRoom')}: {order.roomNumber ?? '—'}</p>
            </div>
          </div>
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
            <Detail label={t('orders.fieldDue')} value={dueLabel} />
            <Detail label={t('orders.fieldTotal')} value={lMoney(order.total, order.currency, locale)} />
            <Detail label={t('orders.fieldExtras')} value={String(order.extras)} />
            <Detail label={t('orders.fieldPayment')} value={order.paymentStatus === 'paid' ? t('orders.paid') : order.paymentStatus === 'partial' ? t('orders.partial') : t('orders.unpaid')} />
            <Detail label={t('orders.created')} value={createdLabel} />
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
        </section>
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
