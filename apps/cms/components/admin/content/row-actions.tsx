'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePreloaderRouter as useRouter } from '@/components/ui/preloader-navigation';
import { Menu } from '@base-ui/react/menu';
import { ArrowPathIcon, EllipsisHorizontalIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { ContentFormState } from '@/app/admin/content/_lib/form-state';
import { Modal } from '@/components/site/modal';
import { useAdminT } from '@/lib/i18n/admin/context';
import { actionMenuItemClass, actionMenuPopupClass, actionMenuTriggerClass, pill } from '@/lib/ui';
import { toast } from '@/components/admin/shell/toast';
import { useUndoableDelete } from '@/components/admin/shell/undoable-delete';
import { cn } from '@/lib/utils';

interface RowActionsProps {
  id: string;
  /** The version the row was read at, so a delete never removes an entity someone has edited since. */
  version: number;
  /** The entity's own name — for the trigger's label and the confirm title. */
  label: string;
  editHref: string;
  deleteAction: (id: string, expectedVersion: number) => Promise<ContentFormState>;
  /** Already in the team member's language. */
  confirmMessage: string;
  /** Set when the service would refuse the delete anyway; the item shows disabled with this reason. */
  deleteBlockedReason?: string;
}

/**
 * A list row's actions behind one "⋯": Edit and Delete. Opens on hover for a
 * mouse, and on click or Enter for touch and keyboard, where hover isn't a
 * thing. Delete always confirms in the product's own dialog, and a rule the
 * service enforces on its own (a booking against it, say) comes back there.
 */
export function RowActions({ id, version, label, editHref, deleteAction, confirmMessage, deleteBlockedReason }: RowActionsProps) {
  const t = useAdminT();
  const router = useRouter();
  const deferDelete = useUndoableDelete();
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
    setConfirming(false);
    const result = await deferDelete(`content:${id}`, label, () => deleteAction(id, version));
    setPending(false);
    if (!result) return;
    if (result.status === 'success') {
      setConfirming(false);
      toast.success(result.message || t('form.labelRemoved', { label }));
      router.refresh();
    } else {
      setError(result.message);
      toast.error(result.message);
    }
  };

  return (
    <>
      <Menu.Root modal={false}>
        <Menu.Trigger
          disabled={pending}
          openOnHover
          delay={80}
          closeDelay={150}
          aria-label={t('form.actionsFor', { label })}
          className={actionMenuTriggerClass}
        >
          <EllipsisHorizontalIcon className="size-6 stroke-[2.5]" aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50 outline-none">
            <Menu.Popup className={`${actionMenuPopupClass} min-w-44`}>
              <Menu.LinkItem render={<Link href={editHref} />} closeOnClick className={actionMenuItemClass}>
                <PencilSquareIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {t('form.edit')}
              </Menu.LinkItem>
              <Menu.Item
                disabled={Boolean(deleteBlockedReason)}
                onClick={() => setConfirming(true)}
                className={cn(actionMenuItemClass, !deleteBlockedReason && 'text-danger data-highlighted:bg-danger/10')}
              >
                <TrashIcon className="size-4 shrink-0" aria-hidden="true" />
                <span className="flex flex-col py-2 text-left">
                  {t('form.delete')}
                  {deleteBlockedReason ? (
                    <span className="text-xs text-muted-foreground">{deleteBlockedReason}</span>
                  ) : null}
                </span>
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <Modal open={confirming} onClose={close} title={t('form.removeLabel', { label })}>
        <p className="text-sm">{confirmMessage}</p>
        {error ? (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={remove} disabled={pending} className={pill('primary')}>
            {pending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t('form.remove')}
          </button>
          <button type="button" onClick={close} className={pill('secondary')}>
            {t('form.keepIt')}
          </button>
        </div>
      </Modal>
    </>
  );
}
