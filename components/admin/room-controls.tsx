'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { fieldClass, pill } from '@/lib/ui';
import { resetDemoState, setRoomStatus } from '@/app/admin/actions';
import type { SaleToggleResult } from '@/components/admin/content/add-on-sale-toggle';
import type { RoomStatus } from '@/lib/domain/schemas';
import { statusLabels } from '@/lib/formatting';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const overrideOptions: { value: RoomStatus | 'auto'; label: string }[] = [
  { value: 'auto', label: 'Auto (simulated)' },
  { value: 'available', label: statusLabels.available },
  { value: 'limited', label: statusLabels.limited },
  { value: 'last_room', label: statusLabels.last_room },
  { value: 'sold_out', label: statusLabels.sold_out },
];

/** Forces a room's status for every date, overriding the simulated demand curve. */
export function RoomStatusControl({
  roomTypeId,
  roomName,
  value,
}: {
  roomTypeId: string;
  roomName: string;
  value: RoomStatus | 'auto';
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const id = `status-${roomTypeId}`;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Availability override for {roomName}
      </label>
      <Select
        items={overrideOptions}
        value={value}
        disabled={pending}
        onValueChange={async (next) => {
          setPending(true);
          await setRoomStatus({
            roomTypeId,
            status: (next ?? 'auto') as RoomStatus | 'auto',
          });
          router.refresh();
          setPending(false);
        }}
      >
        <SelectTrigger id={id} className={cn(fieldClass, 'justify-between gap-2 py-0 disabled:opacity-60')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-2xl border border-border bg-card p-1.5 shadow-soft ring-0">
          {overrideOptions.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="rounded-xl py-2 pl-2.5 text-sm data-highlighted:bg-stone data-highlighted:text-foreground"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pending ? (
        <ArrowPathIcon className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : null}
    </div>
  );
}

/**
 * The on-sale switch in the add-on list. It acts the moment it is flipped — a long list on a phone
 * is easy to brush while scrolling — so for a few seconds afterwards it offers to put it back.
 *
 * Takes the save action as a prop (`setAddOnOnSaleAction`, the same one the add-on's own page
 * uses via `AddOnSaleToggle`) rather than importing one directly, so this list and that page can
 * never drift into two different ideas of what "on sale" means or how a conflict is reported.
 */
export function AddOnToggle({
  addOnId,
  addOnName,
  enabled,
  action,
}: {
  addOnId: string;
  addOnName: string;
  enabled: boolean;
  action: (id: string, enabled: boolean) => Promise<SaleToggleResult>;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [undoTo, setUndoTo] = React.useState<boolean | null>(null);
  const id = `addon-toggle-${addOnId}`;

  React.useEffect(() => {
    if (undoTo === null) return;
    const timer = window.setTimeout(() => setUndoTo(null), 12_000);
    return () => window.clearTimeout(timer);
  }, [undoTo]);

  const change = async (checked: boolean, offerUndo: boolean) => {
    setPending(true);
    setMessage('');
    const result = await action(addOnId, checked);
    if (result.ok) {
      setUndoTo(offerUndo ? !checked : null);
      router.refresh();
    } else {
      // A version conflict or a validation failure must not look like it
      // saved — the switch itself already reflects the server's last-known
      // state once router.refresh() below runs, so this message is what
      // tells the hotel team the flip they just made did not take.
      setUndoTo(null);
      setMessage(result.message);
      router.refresh();
    }
    setPending(false);
  };

  return (
    <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <label htmlFor={id} className="flex cursor-pointer items-center gap-3">
        <Switch
          id={id}
          aria-label={addOnName}
          checked={enabled}
          disabled={pending}
          onCheckedChange={(checked) => change(checked, true)}
          className="shrink-0"
        />
        <span className={cn('font-medium', !enabled && 'text-muted-foreground')}>
          {enabled ? 'On sale' : 'Withdrawn'}
          <span className="sr-only"> — {addOnName}</span>
        </span>
      </label>
      {pending ? (
        <ArrowPathIcon className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : undoTo !== null ? (
        <button
          type="button"
          onClick={() => change(undoTo, false)}
          className="cursor-pointer font-medium underline underline-offset-2"
        >
          Undo<span className="sr-only"> for {addOnName}</span>
        </button>
      ) : null}
      {message ? (
        <p role="status" aria-live="polite" className="w-full text-xs text-muted-foreground basis-full">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function ResetDemoButton() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await resetDemoState();
        router.refresh();
        setPending(false);
      }}
      className={pill('secondary')}
    >
      {pending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
      Reset demo state
    </button>
  );
}
