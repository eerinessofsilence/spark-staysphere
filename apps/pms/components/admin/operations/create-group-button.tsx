'use client';

import * as React from 'react';
import { Preloader } from '@/components/ui/preloader';
import { usePreloaderRouter as useRouter } from '@/components/ui/preloader-navigation';
import { PlusIcon } from '@heroicons/react/24/outline';
import { createGroupAction } from '@/app/admin/groups/actions';
import { useAdminT } from '@/lib/i18n/admin/context';
import { fieldClass, pill, type PillVariant } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/site/modal';
import { toast } from '@/components/admin/shell/toast';

/**
 * The header's own way into `/admin/groups`. A group is just a name (and an
 * optional note) — bookings are attached to it afterward, one at a time,
 * from the group's own page. Reservations' own "Add group booking" is the
 * same flow under a label that says what it's for from that screen, so it
 * takes an override rather than being its own copy of this modal.
 */
export function CreateGroupButton({ label, variant = 'primary' }: { label?: string; variant?: PillVariant } = {}) {
  const t = useAdminT();
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={pill(variant)}>
        <PlusIcon className="size-4 shrink-0" aria-hidden="true" />
        {label ?? t('groups.add')}
      </button>
      <CreateGroupDialog open={open} onClose={close} label={label} />
    </>
  );
}

export function CreateGroupDialog({ open, onClose, label }: { open: boolean; onClose: () => void; label?: string }) {
  const t = useAdminT();
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const close = React.useCallback(() => {
    onClose();
    setName('');
    setNotes('');
    setError('');
  }, [onClose]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const result = await createGroupAction({ name, notes: notes || undefined }).finally(() => setSubmitting(false));
    if (!result.ok) {
      setError(result.message);
      return;
    }
    toast.success(result.message);
    close();
    router.push(`/admin/groups/${result.id}`);
  }

  return (
    <Modal open={open} onClose={close} title={label ?? t('groups.add')}>
      {open ? (
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
              rows={5}
              placeholder={t('groups.notesPlaceholder')}
              className={cn(fieldClass, 'min-h-32 resize-y py-3 leading-relaxed')}
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
          <Preloader active={submitting} label={t('groups.creating')} className="mt-3" />
        </form>
      ) : null}
    </Modal>
  );
}
