'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { resetDemoState, setAddOnEnabled, setRoomStatus } from '@/app/admin/actions';
import type { RoomStatus } from '@/lib/domain/schemas';
import { statusLabels } from '@/lib/formatting';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const overrideOptions: { value: RoomStatus | 'auto'; label: string }[] = [
  { value: 'auto', label: 'Auto (simulated demand)' },
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
      <select
        id={id}
        value={value}
        disabled={pending}
        onChange={async (event) => {
          setPending(true);
          await setRoomStatus({
            roomTypeId,
            status: event.target.value as RoomStatus | 'auto',
          });
          router.refresh();
          setPending(false);
        }}
        className="min-h-11 w-full rounded-xl border border-border bg-card px-3 text-sm disabled:opacity-60"
      >
        {overrideOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {pending ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : null}
    </div>
  );
}

export function AddOnToggle({
  addOnId,
  addOnName,
  enabled,
}: {
  addOnId: string;
  addOnName: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const id = `addon-toggle-${addOnId}`;

  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
      <Switch
        id={id}
        checked={enabled}
        disabled={pending}
        onCheckedChange={async (checked) => {
          setPending(true);
          await setAddOnEnabled({ addOnId, enabled: checked });
          router.refresh();
          setPending(false);
        }}
        className="h-6 w-11 shrink-0"
      />
      <span className={cn('font-medium', !enabled && 'text-muted-foreground')}>
        {enabled ? 'On sale' : 'Withdrawn'}
        <span className="sr-only"> — {addOnName}</span>
      </span>
      {pending ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : null}
    </label>
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
      className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:bg-canvas disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      Reset demo state
    </button>
  );
}
