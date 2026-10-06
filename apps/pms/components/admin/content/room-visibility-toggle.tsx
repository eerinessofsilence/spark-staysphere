'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { INTL_TAGS } from '@/lib/i18n/locale';
import { pill } from '@/lib/ui';
import { toast } from '@/components/admin/shell/toast';
import type { ContentFormState } from '@/app/admin/content/_lib/form-state';
import { announceVersion, useSharedVersion } from './version-channel';
import { useUndoableToggle } from './use-undoable-toggle';

interface RoomVisibilityToggleProps {
  hidden: boolean;
  version: number;
  action: (id: string, hidden: boolean, version: number) => Promise<ContentFormState>;
  roomId: string;
  /** What a hidden room still lacks before it may go on the site, already in the team member's language: "a photo", "a rate". */
  missing?: string[];
}

/**
 * A room's `hidden` flag has no other fields to save alongside it, so it is
 * its own one-click action rather than a field inside the main form. It acts
 * at once, so it says what it did and offers to undo it; and it shares the
 * room's version with the form beside it, so the form's next save is not
 * mistaken for a conflict with this click.
 */
export function RoomVisibilityToggle({ hidden, version: savedVersion, action, roomId, missing = [] }: RoomVisibilityToggleProps) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const router = useRouter();
  const versionKey = `room:${roomId}`;
  const [version, setVersion] = useSharedVersion(versionKey, savedVersion);
  const { pending, setPending, message, setMessage, undoTo, setUndoTo } = useUndoableToggle<boolean>();

  React.useEffect(() => setVersion(savedVersion), [savedVersion, setVersion]);

  const apply = async (nextHidden: boolean, offerUndo: boolean) => {
    setPending(true);
    setMessage('');
    const result = await action(roomId, nextHidden, version);
    if (result.status === 'success' && result.version !== undefined) {
      announceVersion(versionKey, version, result.version);
      setVersion(result.version);
      setUndoTo(offerUndo ? !nextHidden : null);
      toast.success(result.message);
      router.refresh();
    } else {
      setUndoTo(null);
      toast.error(result.message);
    }
    setMessage(result.status === 'success' ? '' : result.message);
    setPending(false);
  };

  const blocked = hidden && missing.length > 0;
  // "a room, a photo and a rate" — the language's own list punctuation and conjunction.
  const missingList = new Intl.ListFormat(INTL_TAGS[locale], { style: 'long', type: 'conjunction' }).format(missing);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        disabled={pending || blocked}
        onClick={() => apply(!hidden, true)}
        className={pill(hidden ? 'primary' : 'secondary')}
      >
        {pending ? (
          <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" />
        ) : hidden ? (
          <EyeIcon className="size-4" aria-hidden="true" />
        ) : (
          <EyeSlashIcon className="size-4" aria-hidden="true" />
        )}
        {hidden ? t('room.showOnSite') : t('room.hideFromSite')}
      </button>
      <p role="status" aria-live="polite" className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
        {message || (blocked ? t('room.addFirst', { items: missingList }) : '')}
        {undoTo !== null && !pending ? (
          <button
            type="button"
            onClick={() => apply(undoTo, false)}
            className="cursor-pointer font-medium text-foreground underline underline-offset-2"
          >
            {t('room.undo')}
          </button>
        ) : null}
      </p>
    </div>
  );
}
