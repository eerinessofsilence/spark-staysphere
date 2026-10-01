'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Modal } from '@/components/site/modal';
import { discardUnsavedChanges } from '@/components/admin/shell/unsaved-changes';
import { useAdminT } from '@/lib/i18n/admin/context';
import { iconButton, pill } from '@/lib/ui';
import { toast } from '@/components/admin/shell/toast';
import { useUndoableDelete } from '@/components/admin/shell/undoable-delete';
import type { ContentFormState } from '@/app/admin/content/_lib/form-state';

type DeleteAction =
  | ((id: string, expectedVersion: number) => Promise<ContentFormState>)
  | ((id: string) => Promise<ContentFormState>);

interface DeleteEntityButtonProps {
  id: string;
  /**
   * The version this delete is conditioned on — same optimistic-concurrency guard as a save.
   * Only some entities (rates, add-ons) track one; omit it for an `action` that deletes by id
   * alone, and the browser's `confirm` is used in place of the product's own dialog below.
   */
  version?: number;
  label: string;
  /**
   * What is being removed, in the dialog's words. The two the CMS has — "rate", "add-on" —
   * are translated here; anything else is shown as given. Used with `version`.
   */
  noun?: string;
  /** A fully custom confirm message for an entity that doesn't fit the `noun` dialog template. */
  confirmMessage?: string;
  action: DeleteAction;
  /** Where to go once the thing this page is about no longer exists. Without it the page refreshes in place. */
  afterDeleteHref?: string;
  /** Where to go once removed, for a button on the removed entity's own page. */
  redirectTo?: string;
  onDeleted?: () => void;
}

/**
 * A hard delete. The page only offers it where `content-service.ts` allows one (CMS-created, no
 * bookings). Entities with a tracked version (rates, add-ons) confirm in the product's own
 * dialog, the same as cancelling a booking; the rest confirm with the browser's `confirm`.
 */
export function DeleteEntityButton({
  id,
  version,
  label,
  noun,
  confirmMessage,
  action,
  afterDeleteHref,
  redirectTo,
  onDeleted,
}: DeleteEntityButtonProps) {
  const t = useAdminT();
  const router = useRouter();
  const deferDelete = useUndoableDelete();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');
  const close = React.useCallback(() => {
    if (!pending) setOpen(false);
  }, [pending]);
  const nounText = noun === 'rate' ? t('form.nounRate') : noun === 'add-on' ? t('form.nounAddOn') : (noun ?? '');

  const finish = async (result: ContentFormState) => {
    if (result.status === 'success') {
      toast.success(result.message || t('form.labelRemoved', { label }));
      if (afterDeleteHref && window.location.pathname === sourcePath.current) {
        discardUnsavedChanges();
        router.replace(afterDeleteHref);
        return;
      }
      if (redirectTo && window.location.pathname === sourcePath.current) router.push(redirectTo);
      else router.refresh();
      onDeleted?.();
      setOpen(false);
    } else {
      setError(result.message);
      toast.error(result.message);
    }
    setPending(false);
  };

  const sourcePath = React.useRef('');
  const remove = async () => {
    setPending(true);
    setError('');
    setOpen(false);
    sourcePath.current = window.location.pathname;
    const result = await deferDelete(`content:${id}`, label, () => version === undefined ? (action as (id: string) => Promise<ContentFormState>)(id) : action(id, version));
    if (!result) { setPending(false); return; }
    await finish(result);
  };

  return (
    <>
      <button
        type="button"
        disabled={pending}
        aria-label={t('form.removeLabel', { label })}
        onClick={() => {
          setError('');
          if (confirmMessage !== undefined) {
            if (window.confirm(confirmMessage)) void remove();
          } else {
            setOpen(true);
          }
        }}
        className={iconButton('light', 'size-11 sm:size-9')}
      >
        {pending ? (
          <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <TrashIcon className="size-4" aria-hidden="true" />
        )}
      </button>

      {confirmMessage === undefined ? (
        <Modal open={open} onClose={close} title={t('form.removeLabelQuestion', { label })}>
          <p className="text-sm">{t('form.deleteBody', { noun: nounText })}</p>
          {error ? (
            <p role="alert" className="mt-3 text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={remove} disabled={pending} className={pill('primary')}>
              {pending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
              {t('form.removeNoun', { noun: nounText })}
            </button>
            <button type="button" onClick={close} disabled={pending} className={pill('secondary')}>
              {t('form.keepIt')}
            </button>
          </div>
        </Modal>
      ) : error ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </>
  );
}
