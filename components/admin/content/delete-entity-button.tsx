'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Modal } from '@/components/site/modal';
import { discardUnsavedChanges } from '@/components/admin/shell/unsaved-changes';
import { iconButton, pill } from '@/lib/ui';
import type { ContentFormState } from '@/app/admin/content/_lib/form-state';

interface DeleteEntityButtonProps {
  id: string;
  /** The version this delete is conditioned on — same optimistic-concurrency guard as a save. */
  version: number;
  label: string;
  /** What is being removed, in the dialog's words: "rate", "add-on". */
  noun: string;
  action: (id: string, expectedVersion: number) => Promise<ContentFormState>;
  /** Where to go once the thing this page is about no longer exists. Without it the page refreshes in place. */
  afterDeleteHref?: string;
}

/**
 * A hard delete. The page only offers it where `content-service.ts` allows one (CMS-created, no
 * bookings), and asks in the product's own dialog — the same as cancelling a booking — rather
 * than the browser's `confirm`.
 */
export function DeleteEntityButton({ id, version, label, noun, action, afterDeleteHref }: DeleteEntityButtonProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');
  const close = React.useCallback(() => {
    if (!pending) setOpen(false);
  }, [pending]);

  const remove = async () => {
    setPending(true);
    setError('');
    const result = await action(id, version);
    if (result.status === 'success') {
      if (afterDeleteHref) {
        discardUnsavedChanges();
        router.replace(afterDeleteHref);
        return;
      }
      setOpen(false);
      router.refresh();
    } else {
      setError(result.message);
    }
    setPending(false);
  };

  return (
    <>
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={() => {
          setError('');
          setOpen(true);
        }}
        className={iconButton('light', 'size-11 sm:size-9')}
      >
        <TrashIcon className="size-4" aria-hidden="true" />
      </button>

      <Modal open={open} onClose={close} title={`Remove ${label}?`}>
        <p className="text-sm">
          The {noun} comes off the site and out of this admin. It can&apos;t be brought back.
        </p>
        {error ? (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={remove} disabled={pending} className={pill('primary')}>
            {pending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
            Remove {noun}
          </button>
          <button type="button" onClick={close} disabled={pending} className={pill('secondary')}>
            Keep it
          </button>
        </div>
      </Modal>
    </>
  );
}
