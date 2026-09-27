'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon } from '@heroicons/react/24/outline';
import { createGroupAction } from '@/app/admin/groups/actions';
import { useAdminT } from '@/lib/i18n/admin/context';
import { fieldClass, pill } from '@/lib/ui';
import { Modal } from '@/components/site/modal';
import { toast } from '@/components/admin/shell/toast';

/**
 * The header's own way into `/admin/groups`, the same spot `AddBookingButton`
 * takes on Reservations. A group is just a name (and an optional note) —
 * bookings are attached to it afterward, one at a time, from the group's
 * own page.
 */
export function CreateGroupButton() {
  const t = useAdminT();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const close = React.useCallback(() => {
    setOpen(false);
    setName('');
    setNotes('');
    setError('');
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const result = await createGroupAction({ name, notes: notes || undefined });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    toast.success(result.message);
    close();
    router.push(`/admin/groups/${result.id}`);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill('primary')}>
        <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
        {t('groups.add')}
      </button>

      <Modal open={open} onClose={close} title={t('groups.add')}>
        <form onSubmit={submit} className="grid gap-4">
          <div>
            <label htmlFor="group-name" className="mb-1.5 block text-sm text-muted-foreground">
              {t('groups.name')}
            </label>
            <input
              id="group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoFocus
              placeholder={t('groups.namePlaceholder')}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="group-notes" className="mb-1.5 block text-sm text-muted-foreground">
              {t('groups.notes')}
            </label>
            <textarea
              id="group-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder={t('groups.notesPlaceholder')}
              className={fieldClass}
            />
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
            <button type="submit" disabled={submitting || !name.trim()} className={pill('primary')}>
              {submitting ? t('groups.creating') : t('groups.create')}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
