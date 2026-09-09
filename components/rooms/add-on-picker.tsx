'use client';

import * as React from 'react';
import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { AddOn } from '@/lib/domain/schemas';
import { formatMoney } from '@/lib/formatting';
import { AddOnCatalog } from './add-on-catalog';
import { useRoomPricing } from './room-pricing';
import { cn } from '@/lib/utils';

interface AddOnPickerProps {
  addOns: AddOn[];
}

export function AddOnPicker({ addOns }: AddOnPickerProps) {
  // Selection and repricing belong to the page, not to this list: the two
  // pickers and the summary all sell into the same quote.
  const { selected, repricing: isPending, setAddOns: change } = useRoomPricing();
  const enabled = addOns.filter((addOn) => addOn.enabled);

  if (enabled.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        Nothing is on sale for this stay right now.
      </p>
    );
  }

  return (
    <div className={cn('grid gap-3', isPending && 'opacity-70')} aria-busy={isPending}>
      <AddOnCatalog addOns={addOns} selected={selected} onChange={change} />
      {isPending ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowPathIcon className="size-3.5 animate-spin" aria-hidden="true" />
          Repricing your stay…
        </p>
      ) : null}
    </div>
  );
}

/**
 * Line-item view of the server's quote. Never recomputed on the client, and
 * editable in place: a guest who changes their mind should not have to find
 * the card they bought something from.
 */
export function QuoteLines() {
  const { quote, selected, repricing: isPending, setAddOns } = useRoomPricing();
  const { price } = quote;

  /** Drops a line, and anything that was only ever an extra on it. */
  const remove = (addOnId: string) => {
    const alsoGoing = new Set(
      price.addOnLines.filter((line) => line.parentId === addOnId).map((line) => line.addOnId),
    );
    setAddOns(selected.filter((id) => id !== addOnId && !alsoGoing.has(id)));
  };

  return (
    <dl className={cn('grid gap-2 text-sm', isPending && 'opacity-60')} aria-busy={isPending}>
      <BillRow
        label={`${formatMoney(price.nightlyPrice, price.currency)} × ${price.nights} ${price.nights === 1 ? 'night' : 'nights'}`}
        value={formatMoney(price.roomTotal, price.currency)}
      />
      {price.addOnLines.map((line) => (
        <BillRow
          key={line.addOnId}
          label={`${line.name}${line.quantity > 1 ? ` × ${line.quantity}` : ''}`}
          value={formatMoney(line.total, price.currency)}
          // An extra reads as belonging to the thing above it, not as its own order.
          indented={Boolean(line.parentId)}
          onRemove={() => remove(line.addOnId)}
          removeLabel={`Remove ${line.name}`}
        />
      ))}
      <BillRow label="Taxes and city fees" value={formatMoney(price.taxesAndFees, price.currency)} />
    </dl>
  );
}

/**
 * One line of the bill. The three columns are fixed so the prices line up and
 * the crosses stack into a column of their own — a row without one still holds
 * its place, otherwise every removable line would shift its price.
 */
export function BillRow({
  label,
  value,
  indented,
  onRemove,
  removeLabel,
}: {
  label: string;
  value: string;
  indented?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto_2rem] items-baseline gap-x-3',
        indented && 'pl-4',
      )}
    >
      <dt className="text-muted-foreground">
        {indented ? <span aria-hidden="true">+ </span> : null}
        {label}
      </dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
      {onRemove ? (
        <RemoveButton label={removeLabel ?? `Remove ${label}`} onClick={onRemove} />
      ) : (
        <span aria-hidden="true" />
      )}
    </div>
  );
}

/**
 * A visible control, not a stray mark: a filled circle the size of the text
 * beside it, drawn at 32px and taking taps across 44. The reach beyond its
 * circle is an overlay, so the bill's line height is unaffected.
 */
export function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="relative grid size-8 shrink-0 cursor-pointer place-items-center self-center rounded-full bg-stone/70 text-muted-foreground transition-colors after:absolute after:-inset-1.5 after:content-[''] hover:bg-stone hover:text-foreground"
    >
      <XMarkIcon className="size-3.5" aria-hidden="true" />
    </button>
  );
}
