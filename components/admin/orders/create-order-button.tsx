'use client';

import * as React from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { createOrderAction } from '@/app/admin/orders/actions';
import type { OrderCategory, OrderDelivery, OrderPaymentStatus, OrderStatus } from '@/lib/domain/orders';
import type { AdminTranslationKey } from '@/lib/i18n/admin/dictionaries';
import { useAdminT } from '@/lib/i18n/admin/context';
import { fieldClass, pill } from '@/lib/ui';
import { Modal } from '@/components/site/modal';
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from '@/components/admin/shell/toast';

const categories: OrderCategory[] = ['dining', 'wellness', 'experience', 'transport', 'room'];
const deliveries: OrderDelivery[] = ['Without delivery', 'Room delivery', 'Hotel pickup'];
const paymentStatuses: OrderPaymentStatus[] = ['unpaid', 'partial', 'paid'];

const categoryKeys: Record<OrderCategory, AdminTranslationKey> = {
  dining: 'orders.categoryDining',
  wellness: 'orders.categoryWellness',
  experience: 'orders.categoryExperience',
  transport: 'orders.categoryTransport',
  room: 'orders.categoryRoom',
};

function defaultDueValue(): string {
  const value = new Date(Date.now() + 60 * 60 * 1000);
  value.setMinutes(0, 0, 0);
  return value.toISOString().slice(0, 16);
}

export function CreateOrderButton({ guests, services, rooms }: { guests: string[]; services: string[]; rooms: string[] }) {
  const t = useAdminT();
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill('primary')}>
        <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
        {t('orders.create')}
      </button>
      <Modal open={open} onClose={close} title={t('orders.createTitle')} className="sm:max-w-2xl">
        {open ? <CreateOrderForm guests={guests} services={services} rooms={rooms} onClose={close} /> : null}
      </Modal>
    </>
  );
}

function CreateOrderForm({ guests, services, rooms, onClose }: { guests: string[]; services: string[]; rooms: string[]; onClose: () => void }) {
  const t = useAdminT();
  const [guestName, setGuestName] = React.useState('');
  const [roomNumber, setRoomNumber] = React.useState('');
  const [serviceName, setServiceName] = React.useState('');
  const [category, setCategory] = React.useState<OrderCategory>('dining');
  const [delivery, setDelivery] = React.useState<OrderDelivery>('Without delivery');
  const [dueAt, setDueAt] = React.useState(defaultDueValue);
  const [total, setTotal] = React.useState('0');
  const [extras, setExtras] = React.useState('0');
  const [paymentStatus, setPaymentStatus] = React.useState<OrderPaymentStatus>('unpaid');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setFieldErrors({});
    const result = await createOrderAction({
      guestName,
      roomNumber,
      serviceName,
      category,
      delivery,
      dueAt: new Date(dueAt).toISOString(),
      total,
      extras,
      paymentStatus,
      status: 'new' satisfies OrderStatus,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }
    toast.success(result.message);
    onClose();
  }

  const errorFor = (key: string) => fieldErrors[key]?.[0];

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('orders.fieldGuest')} htmlFor="order-guest" error={errorFor('guestName')}>
          <input id="order-guest" list="order-guests" value={guestName} onChange={(event) => setGuestName(event.target.value)} required autoFocus className={fieldClass} />
          <datalist id="order-guests">{guests.map((name) => <option key={name} value={name} />)}</datalist>
        </Field>
        <Field label={t('orders.fieldRoom')} htmlFor="order-room" error={errorFor('roomNumber')}>
          <input id="order-room" list="order-rooms" value={roomNumber} onChange={(event) => setRoomNumber(event.target.value)} className={fieldClass} />
          <datalist id="order-rooms">{rooms.map((room) => <option key={room} value={room} />)}</datalist>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
        <Field label={t('orders.fieldService')} htmlFor="order-service" error={errorFor('serviceName')}>
          <input id="order-service" list="order-services" value={serviceName} onChange={(event) => setServiceName(event.target.value)} required className={fieldClass} />
          <datalist id="order-services">{services.map((name) => <option key={name} value={name} />)}</datalist>
        </Field>
        <Field label={t('orders.fieldCategory')} htmlFor="order-category" error={errorFor('category')}>
          <NativeSelect id="order-category" value={category} onChange={(event) => setCategory(event.target.value as OrderCategory)}>
            {categories.map((value) => <option key={value} value={value}>{t(categoryKeys[value])}</option>)}
          </NativeSelect>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('orders.fieldDelivery')} htmlFor="order-delivery" error={errorFor('delivery')}>
          <NativeSelect id="order-delivery" value={delivery} onChange={(event) => setDelivery(event.target.value as OrderDelivery)}>
            {deliveries.map((value) => <option key={value} value={value}>{value === 'Room delivery' ? t('orders.roomDelivery') : value === 'Hotel pickup' ? t('orders.hotelPickup') : t('orders.withoutDelivery')}</option>)}
          </NativeSelect>
        </Field>
        <Field label={t('orders.fieldDue')} htmlFor="order-due" error={errorFor('dueAt')}>
          <input id="order-due" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} required className={fieldClass} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('orders.fieldTotal')} htmlFor="order-total" error={errorFor('total')}>
          <input id="order-total" type="number" min="0" step="0.01" value={total} onChange={(event) => setTotal(event.target.value)} required className={fieldClass} />
        </Field>
        <Field label={t('orders.fieldExtras')} htmlFor="order-extras" error={errorFor('extras')}>
          <input id="order-extras" type="number" min="0" max="99" step="1" value={extras} onChange={(event) => setExtras(event.target.value)} required className={fieldClass} />
        </Field>
        <Field label={t('orders.fieldPayment')} htmlFor="order-payment" error={errorFor('paymentStatus')}>
          <NativeSelect id="order-payment" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as OrderPaymentStatus)}>
            {paymentStatuses.map((value) => <option key={value} value={value}>{value === 'paid' ? t('orders.paid') : value === 'partial' ? t('orders.partial') : t('orders.unpaid')}</option>)}
          </NativeSelect>
        </Field>
      </div>

      {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} className={pill('secondary')}>{t('frontDesk.cancel')}</button>
        <button type="submit" disabled={submitting} className={pill('primary')}>{submitting ? t('orders.creating') : t('orders.create')}</button>
      </div>
    </form>
  );
}

function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm text-muted-foreground">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
