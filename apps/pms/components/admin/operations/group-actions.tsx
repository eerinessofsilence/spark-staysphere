'use client';

import { Preloader } from '@/components/ui/preloader';

import * as React from 'react';
import { usePreloaderRouter as useRouter } from '@/components/ui/preloader-navigation';
import { ArrowPathIcon, PlusIcon, TrashIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { assignBookingToGroupAction, deleteGroupAction, removeBookingFromGroupAction } from '@/app/admin/groups/actions';
import { useAdminT } from '@/lib/i18n/admin/context';
import { fieldClass, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/site/modal';
import { toast } from '@/components/admin/shell/toast';
import { useUndoableDelete } from '@/components/admin/shell/undoable-delete';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchInput } from '@/components/ui/search-input';

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
  const [query, setQuery] = React.useState('');
  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => `${option.reference} ${option.guestName}`.toLowerCase().includes(needle));
  }, [options, query]);
  const [bookingId, setBookingId] = React.useState(options[0]?.id ?? '');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  // `options` is server data, refreshed by the router after a successful
  // attach — the option just picked is gone from the next list, so the
  // trigger would otherwise be left showing its bare id instead of a label.
  // The same reset applies as the search narrows `filtered` past it.
  React.useEffect(() => {
    if (!filtered.some((option) => option.id === bookingId)) setBookingId(filtered[0]?.id ?? '');
  }, [filtered, bookingId]);

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
        <label htmlFor="attach-booking-search" className="mb-1.5 block text-sm text-muted-foreground">
          {t('groups.attachSearchLabel')}
        </label>
        <SearchInput
          id="attach-booking-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          suggestions={options.map((option) => ({ value: option.reference, label: option.guestName, detail: `${option.reference} · ${option.roomName}` }))}
          suggestionsLabel={t('groups.attachSearchLabel')}
          onSuggestionSelect={(item) => setQuery(item.value)}
          placeholder={t('groups.attachSearchPlaceholder')}
          className="mb-2"
        />
        <label htmlFor="attach-booking" className="mb-1.5 block text-sm text-muted-foreground">
          {t('groups.attachBooking')}
        </label>
        {filtered.length === 0 ? (
          <p className="min-h-11 rounded-2xl border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground">
            {t('groups.attachNoMatch', { query })}
          </p>
        ) : (
          <Select items={filtered.map((option) => ({ value: option.id, label: `${option.reference} — ${option.guestName} — ${option.roomName}` }))} value={bookingId} onValueChange={(value) => value && setBookingId(value)}>
            <SelectTrigger id="attach-booking" className={cn(fieldClass, 'h-11 w-full justify-between gap-2 py-0')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border border-border bg-card p-1.5 shadow-soft ring-0">
              {filtered.map((option) => (
                <SelectItem key={option.id} value={option.id} className="rounded-xl py-2 pl-2.5 text-sm data-highlighted:bg-stone data-highlighted:text-foreground">
                  {option.reference} — {option.guestName} — {option.roomName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <button type="submit" disabled={submitting || !bookingId} className={pill('primary')}>
        {submitting ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : <PlusIcon className="size-4 shrink-0" aria-hidden="true" />}
        {t('groups.attach')}
      </button>
      {error ? (
        <p role="alert" className="w-full text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <Preloader active={submitting} label={t('form.saving')} className="mt-3" />
    </form>
  );
}

export function RemoveFromGroupButton({ bookingId, reference }: { bookingId: string; reference: string }) {
  const t = useAdminT();
  const router = useRouter();
  const deferDelete = useUndoableDelete();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  async function remove() {
    setPending(true);
    close();
    const result = await deferDelete(`group-booking:${bookingId}`, reference, () => removeBookingFromGroupAction(bookingId));
    setPending(false);
    if (!result) return;
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
        disabled={pending}
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
  const deferDelete = useUndoableDelete();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  async function remove() {
    setPending(true);
    close();
    const sourcePath = window.location.pathname;
    const result = await deferDelete(`group:${groupId}`, name, () => deleteGroupAction(groupId));
    setPending(false);
    if (!result) return;
    close();
    if (result.ok) {
      toast.success(result.message);
      if (window.location.pathname === sourcePath) router.push('/admin/groups');
      router.refresh();
    } else {
      toast.error(result.message);
    }
  }

  return (
    <>
      <button type="button" disabled={pending} onClick={() => setOpen(true)} className={pill('secondary')}>
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
