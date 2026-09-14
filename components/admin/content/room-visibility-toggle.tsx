'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { pill } from '@/lib/ui';
import type { ContentFormState } from '@/app/admin/content/_lib/form-state';

interface RoomVisibilityToggleProps {
  hidden: boolean;
  version: number;
  action: (id: string, hidden: boolean, version: number) => Promise<ContentFormState>;
  roomId: string;
}

/**
 * A room's `hidden` flag has no other fields to save alongside it, so it is
 * its own one-click action rather than a field inside the main form —
 * mirrors `/admin`'s room-status `<select>` and add-on `Switch`.
 */
export function RoomVisibilityToggle({ hidden, version, action, roomId }: RoomVisibilityToggleProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState('');

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setMessage('');
          const result = await action(roomId, !hidden, version);
          setMessage(result.message);
          if (result.status === 'success') router.refresh();
          setPending(false);
        }}
        className={pill(hidden ? 'primary' : 'secondary')}
      >
        {pending ? (
          <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" />
        ) : hidden ? (
          <EyeIcon className="size-4" aria-hidden="true" />
        ) : (
          <EyeSlashIcon className="size-4" aria-hidden="true" />
        )}
        {hidden ? 'Show on the site' : 'Hide from the site'}
      </button>
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {message}
      </p>
    </div>
  );
}
