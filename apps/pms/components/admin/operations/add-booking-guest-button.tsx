'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon } from '@heroicons/react/24/outline';
import { addBookingGuestAction } from '@/app/admin/bookings/actions';
import { useAdminT } from '@/lib/i18n/admin/context';
import { fieldClass, pill } from '@/lib/ui';
import { Modal } from '@/components/site/modal';
import { toast } from '@/components/admin/shell/toast';

export function AddBookingGuestButton({
  reference,
  adultSlots,
  childSlots,
}: {
  reference: string;
  adultSlots: number;
  childSlots: number;
}) {
  const t = useAdminT();
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => setMounted(true), []);

  function close() {
    if (submitting) return;
    setOpen(false);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setError('');
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const category = adultSlots > 0 ? 'adult' : 'child';
      const result = await addBookingGuestAction(reference, { category, firstName, lastName, email, phone });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success(result.message);
      setOpen(false);
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      router.refresh();
    } catch {
      setError(t('booking.guestSaveFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="mt-5 border-t border-border pt-5">
        <button
          type="button"
          disabled={!mounted}
          onClick={() => setOpen(true)}
          className={pill('secondary', 'w-full justify-center text-sm')}
        >
          <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
          {t('booking.addGuest')}
        </button>
        <p className="mt-2 text-xs text-muted-foreground">
          {t('booking.guestPlaces', { count: adultSlots + childSlots })}
        </p>
      </div>

      <Modal open={open} onClose={close} title={t('booking.addGuest')}>
        <form onSubmit={submit} className="grid gap-4">
          <p className="text-sm text-muted-foreground">{t('booking.guestContactOptional')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="booking-guest-first-name" className="mb-1.5 block text-sm text-muted-foreground">{t('guests.firstName')}</label>
              <input id="booking-guest-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} required maxLength={100} autoFocus className={fieldClass} />
            </div>
            <div>
              <label htmlFor="booking-guest-last-name" className="mb-1.5 block text-sm text-muted-foreground">{t('guests.lastName')}</label>
              <input id="booking-guest-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} required maxLength={100} className={fieldClass} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="booking-guest-email" className="mb-1.5 block text-sm text-muted-foreground">{t('account.email')}</label>
              <input id="booking-guest-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="booking-guest-phone" className="mb-1.5 block text-sm text-muted-foreground">{t('account.phone')}</label>
              <input id="booking-guest-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={fieldClass} />
            </div>
          </div>
          {error ? <p role="alert" className="text-sm font-medium text-danger">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={submitting} onClick={close} className={pill('secondary')}>{t('frontDesk.cancel')}</button>
            <button type="submit" disabled={submitting} className={pill('primary')}>{t('booking.addGuest')}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
