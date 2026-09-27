'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, PlusIcon, TrashIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { assignBookingToGroupAction, deleteGroupAction, removeBookingFromGroupAction } from '@/app/admin/groups/actions';
import { useAdminT } from '@/lib/i18n/admin/context';
import { fieldClass, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/site/modal';
import { toast } from '@/components/admin/shell/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface AttachableBooking {
  id: string;
  reference: string;
  guestName: string;
  roomName: string;
}

/**
 * The one way a booking joins a group: picked from the hotel's own
 * not-yet-grouped bookings, not created fresh here — the front desk's own
 * "Add booking" already covers creating one, so this only ever attaches an
 * existing one, the same "attach, don't recreate" rule `ScanRoomButton`
 * applies to a room already on sale.
 */
export function AttachBookingForm({ groupId, options }: { groupId: string; options: AttachableBooking[] }) {
  const t = useAdminT();
  const router = useRouter();
  const [bookingId, setBookingId] = React.useState(options[0]?.id ?? '');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  // `options` is server data, refreshed by the router after a successful
  // attach — the option just picked is gone from the next list, so the
  // trigger would otherwise be left showing its bare id instead of a label.
  React.useEffect(() => {
    if (!options.some((option) => option.id === bookingId)) setBookingId(options[0]?.id ?? '');
  }, [options, bookingId]);

  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('groups.noAttachable')}</p>;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!bookingId) return;
    setSubmitting(true);
    setError('');
    const result = await assignBookingToGroupAction(groupId, bookingId);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    toast.success(result.message);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <div className="min-w-56 flex-1">
        <label htmlFor="attach-booking" className="mb-1.5 block text-sm text-muted-foreground">
          {t('groups.attachBooking')}
        </label>
        <Select items={options.map((option) => ({ value: option.id, label: `${option.reference} — ${option.guestName} — ${option.roomName}` }))} value={bookingId} onValueChange={(value) => value && setBookingId(value)}>
          <SelectTrigger id="attach-booking" className={cn(fieldClass, 'h-11 w-full justify-between gap-2 py-0')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-2xl border border-border bg-card p-1.5 shadow-soft ring-0">
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id} className="rounded-xl py-2 pl-2.5 text-sm data-highlighted:bg-stone data-highlighted:text-foreground">
                {option.reference} — {option.guestName} — {option.roomName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <button type="submit" disabled={submitting} className={pill('primary')}>
        {submitting ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : <PlusIcon className="size-4 shrink-0" aria-hidden="true" />}
        {t('groups.attach')}
      </button>
      {error ? (
        <p role="alert" className="w-full text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function RemoveFromGroupButton({ bookingId, reference }: { bookingId: string; reference: string }) {
  const t = useAdminT();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  async function remove() {
    setPending(true);
    const result = await removeBookingFromGroupAction(bookingId);
    setPending(false);
    close();
    if (result.ok) {
      toast.success(result.message);
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('groups.removeFromGroup')}
        className="relative z-10 inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <XCircleIcon className="size-4.5" aria-hidden="true" />
      </button>
      <Modal open={open} onClose={close} title={t('groups.removeFromGroup')}>
        <p className="text-sm">{t('groups.removeConfirm', { reference })}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={remove} disabled={pending} className={pill('primary')}>
            {pending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t('groups.removeFromGroup')}
          </button>
          <button type="button" onClick={close} className={pill('secondary')}>
            {t('frontDesk.cancel')}
          </button>
        </div>
      </Modal>
    </>
  );
}

export function DeleteGroupButton({ groupId, name }: { groupId: string; name: string }) {
  const t = useAdminT();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  async function remove() {
    setPending(true);
    const result = await deleteGroupAction(groupId);
    setPending(false);
    close();
    if (result.ok) {
      toast.success(result.message);
      router.push('/admin/groups');
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill('secondary')}>
        <TrashIcon className="size-4 shrink-0" aria-hidden="true" />
        {t('groups.delete')}
      </button>
      <Modal open={open} onClose={close} title={t('groups.delete')}>
        <p className="text-sm">{t('groups.deleteConfirm', { name })}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={remove} disabled={pending} className={pill('primary')}>
            {pending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t('groups.delete')}
          </button>
          <button type="button" onClick={close} className={pill('secondary')}>
            {t('frontDesk.cancel')}
          </button>
        </div>
      </Modal>
    </>
  );
}
