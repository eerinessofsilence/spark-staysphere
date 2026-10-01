'use client';

import Link from 'next/link';
import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import { EllipsisHorizontalIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { menuItemClass } from './booking-row-actions';
import { deleteGuestProfileAction } from '@/app/admin/guests/delete-action';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/admin/shell/toast';
import { usePendingDeletions, useUndoableDelete } from '@/components/admin/shell/undoable-delete';

export function GuestTableRow({ id, hotelId, children }: { id: string; hotelId: string; children: React.ReactNode }) {
  const deletions = usePendingDeletions();
  const hidden = deletions.some((item) => item.key === `guest:${hotelId}:${id}`);
  return <tr hidden={hidden} className="relative border-b border-border transition-colors last:border-b-0 hover:bg-stone/50">{children}</tr>;
}

export function GuestRowActions({ id, hotelId, name, canDelete }: { id: string; hotelId: string; name: string; canDelete: boolean }) {
  const router = useRouter();
  const deferDelete = useUndoableDelete();
  const [pending, setPending] = React.useState(false);
  async function remove() {
    setPending(true);
    const result = await deferDelete(`guest:${hotelId}:${id}`, name, () => deleteGuestProfileAction(id, hotelId));
    setPending(false);
    if (!result) return;
    if (result.ok) { toast.success(result.message); router.refresh(); }
    else toast.error(result.message);
  }
  return <Menu.Root modal={false}>
    <Menu.Trigger aria-label="Guest actions" className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-stone hover:text-foreground data-popup-open:bg-stone">
      <EllipsisHorizontalIcon className="size-5" aria-hidden="true" />
    </Menu.Trigger>
    <Menu.Portal><Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50 outline-none">
      <Menu.Popup className="min-w-44 rounded-2xl border border-border bg-card p-1.5 text-foreground shadow-soft outline-none">
        <Menu.LinkItem render={<Link href={`/admin/guests/${encodeURIComponent(id)}`} />} className={menuItemClass}>
          <PencilSquareIcon className="size-4" aria-hidden="true" /> Edit guest
        </Menu.LinkItem>
        <Menu.Item disabled={!canDelete || pending} onClick={remove} className={`${menuItemClass} text-danger`}>
          <TrashIcon className="size-4" aria-hidden="true" /> Delete guest
        </Menu.Item>
      </Menu.Popup>
    </Menu.Positioner></Menu.Portal>
  </Menu.Root>;
}
