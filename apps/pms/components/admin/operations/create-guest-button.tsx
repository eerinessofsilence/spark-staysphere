'use client';

import * as React from 'react';
import { Preloader } from '@/components/ui/preloader';
import { usePreloaderRouter as useRouter } from '@/components/ui/preloader-navigation';
import { PlusIcon } from '@heroicons/react/24/outline';
import { createGuestAction } from '@/app/admin/guests/actions';
import { useAdminT } from '@/lib/i18n/admin/context';
import { fieldClass, pill } from '@/lib/ui';
import { Modal } from '@/components/site/modal';
import { toast } from '@/components/admin/shell/toast';

/**
 * The header's own way to put a guest on file before any booking exists —
 * the same spot `AddBookingButton` and `CreateGroupButton` take on their
 * own pages.
 */
export function CreateGuestButton() {
  const t = useAdminT();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const close = React.useCallback(() => {
    setOpen(false);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setError('');
    setFieldErrors({});
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setFieldErrors({});
    const result = await createGuestAction({ firstName, lastName, email, phone }).finally(() => setSubmitting(false));
    if (!result.ok) {
      setError(result.message);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }
    toast.success(result.message);
    close();
    router.push(`/admin/guests/${encodeURIComponent(result.id!)}`);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill('primary')}>
        <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
        {t('guests.add')}
      </button>

      <Modal open={open} onClose={close} title={t('guests.add')}>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="guest-first-name" className="mb-1.5 block text-sm text-muted-foreground">
                {t('guests.firstName')}
              </label>
              <input id="guest-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} required autoFocus className={fieldClass} />
              {fieldErrors.firstName?.[0] ? <p className="mt-1 text-xs text-danger">{fieldErrors.firstName[0]}</p> : null}
            </div>
            <div>
              <label htmlFor="guest-last-name" className="mb-1.5 block text-sm text-muted-foreground">
                {t('guests.lastName')}
              </label>
              <input id="guest-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} required className={fieldClass} />
              {fieldErrors.lastName?.[0] ? <p className="mt-1 text-xs text-danger">{fieldErrors.lastName[0]}</p> : null}
            </div>
          </div>

          <div>
            <label htmlFor="guest-email" className="mb-1.5 block text-sm text-muted-foreground">
              {t('account.email')}
            </label>
            <input id="guest-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className={fieldClass} />
            {fieldErrors.email?.[0] ? <p className="mt-1 text-xs text-danger">{fieldErrors.email[0]}</p> : null}
          </div>

          <div>
            <label htmlFor="guest-phone" className="mb-1.5 block text-sm text-muted-foreground">
              {t('account.phone')}
            </label>
            <input id="guest-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required className={fieldClass} />
            {fieldErrors.phone?.[0] ? <p className="mt-1 text-xs text-danger">{fieldErrors.phone[0]}</p> : null}
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={close} className={pill('secondary')}>
              {t('frontDesk.cancel')}
            </button>
            <button type="submit" disabled={submitting} className={pill('primary')}>
              {submitting ? t('groups.creating') : t('guests.create')}
            </button>
          </div>
          <Preloader active={submitting} label={t('groups.creating')} className="mt-3" />
        </form>
      </Modal>
    </>
  );
}
