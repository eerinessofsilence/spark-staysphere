'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu } from '@base-ui/react/menu';
import { ArrowPathIcon, EllipsisHorizontalIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { ContentFormState } from '@/app/admin/content/_lib/form-state';
import { Modal } from '@/components/site/modal';
import { pill } from '@/lib/ui';
import { cn } from '@/lib/utils';

interface RowActionsProps {
  id: string;
  /** The entity's own name — for the trigger's label and the confirm title. */
  label: string;
  editHref: string;
  deleteAction: (id: string) => Promise<ContentFormState>;
  confirmMessage: string;
  /** Set when the service would refuse the delete anyway; the item shows disabled with this reason. */
  deleteBlockedReason?: string;
}

const itemClass =
  'flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none select-none data-highlighted:bg-stone data-disabled:cursor-not-allowed data-disabled:opacity-60';

/**
 * A list row's actions behind one "⋯": Edit and Delete. Opens on hover for a
 * mouse, and on click or Enter for touch and keyboard, where hover isn't a
 * thing. Delete always confirms in the product's own dialog, and a rule the
 * service enforces on its own (a booking against it, say) comes back there.
 */
export function RowActions({ id, label, editHref, deleteAction, confirmMessage, deleteBlockedReason }: RowActionsProps) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');
  const close = React.useCallback(() => {
    setConfirming(false);
    setError('');
  }, []);

  const remove = async () => {
    setPending(true);
    setError('');
    const result = await deleteAction(id);
    setPending(false);
    if (result.status === 'success') {
      setConfirming(false);
      router.refresh();
    } else {
      setError(result.message);
    }
  };

  return (
    <>
      <Menu.Root modal={false}>
        <Menu.Trigger
          openOnHover
          delay={80}
          closeDelay={150}
          aria-label={`Actions for ${label}`}
          className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-stone hover:text-foreground data-popup-open:bg-stone data-popup-open:text-foreground"
        >
          <EllipsisHorizontalIcon className="size-5" aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50 outline-none">
            <Menu.Popup className="min-w-44 rounded-2xl border border-border bg-card p-1.5 text-foreground shadow-soft outline-none">
              <Menu.LinkItem render={<Link href={editHref} />} className={itemClass}>
                <PencilSquareIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                Edit
              </Menu.LinkItem>
              <Menu.Item
                disabled={Boolean(deleteBlockedReason)}
                onClick={() => setConfirming(true)}
                className={cn(itemClass, !deleteBlockedReason && 'text-danger data-highlighted:bg-danger/10')}
              >
                <TrashIcon className="size-4 shrink-0" aria-hidden="true" />
                <span className="flex flex-col py-2 text-left">
                  Delete
                  {deleteBlockedReason ? (
                    <span className="text-xs text-muted-foreground">{deleteBlockedReason}</span>
                  ) : null}
                </span>
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <Modal open={confirming} onClose={close} title={`Remove ${label}`}>
        <p className="text-sm">{confirmMessage}</p>
        {error ? (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={remove} disabled={pending} className={pill('primary')}>
            {pending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
            Remove
          </button>
          <button type="button" onClick={close} className={pill('secondary')}>
            Keep it
          </button>
        </div>
      </Modal>
    </>
  );
}
