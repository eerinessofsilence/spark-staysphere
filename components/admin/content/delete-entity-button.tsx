'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline';
import { iconButton } from '@/lib/ui';
import type { ContentFormState } from '@/app/admin/content/_lib/form-state';

interface DeleteEntityButtonProps {
  id: string;
  label: string;
  confirmMessage: string;
  action: (id: string) => Promise<ContentFormState>;
  onDeleted?: () => void;
  /** Where to go once removed, for a button on the removed entity's own page. */
  redirectTo?: string;
}

/** A hard delete, gated by `content-service.ts` (CMS-created, no bookings) and a confirm here. */
export function DeleteEntityButton({ id, label, confirmMessage, action, onDeleted, redirectTo }: DeleteEntityButtonProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        aria-label={`Remove ${label}`}
        onClick={async () => {
          if (!window.confirm(confirmMessage)) return;
          setPending(true);
          setError('');
          const result = await action(id);
          if (result.status === 'success') {
            if (redirectTo) router.push(redirectTo);
            else router.refresh();
            onDeleted?.();
          } else {
            setError(result.message);
          }
          setPending(false);
        }}
        className={iconButton('light', 'size-9')}
      >
        {pending ? (
          <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <TrashIcon className="size-4" aria-hidden="true" />
        )}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
