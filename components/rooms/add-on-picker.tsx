'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { buildQuery } from '@/lib/application/search-params';
import type { AddOn, Quote, StayCriteria } from '@/lib/domain/schemas';
import { formatMoney } from '@/lib/formatting';
import { AddOnCatalog } from './add-on-catalog';
import { cn } from '@/lib/utils';

interface AddOnPickerProps {
  addOns: AddOn[];
  criteria: StayCriteria;
  /** Selection lives in the URL so the server re-quotes and owns every total. */
  selected: string[];
}

export function AddOnPicker({ addOns, criteria, selected }: AddOnPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = React.useTransition();
  const enabled = addOns.filter((addOn) => addOn.enabled);

  const change = (next: string[]) => {
    const query = buildQuery({ criteria, addOnIds: next });
    startTransition(() => router.replace(`${pathname}?${query}`, { scroll: false }));
  };

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

interface QuoteLinesProps {
  quote: Quote;
  /**
   * Pass the stay and the current selection to make the summary editable: a
   * guest who changes their mind should not have to find the card they bought
   * something from. Left out on a screen where the order is already placed.
   */
  criteria?: StayCriteria;
  selected?: string[];
}

/** Line-item view of a server quote. Never recomputed on the client. */
export function QuoteLines({ quote, criteria, selected }: QuoteLinesProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = React.useTransition();
  const { price } = quote;
  const editable = Boolean(criteria && selected);

  /** Drops a line, and anything that was only ever an extra on it. */
  const remove = (addOnId: string) => {
    if (!criteria || !selected) return;
    const alsoGoing = new Set(
      price.addOnLines.filter((line) => line.parentId === addOnId).map((line) => line.addOnId),
    );
    const next = selected.filter((id) => id !== addOnId && !alsoGoing.has(id));
    const query = buildQuery({ criteria, addOnIds: next });
    startTransition(() => router.replace(`${pathname}?${query}`, { scroll: false }));
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
          onRemove={editable ? () => remove(line.addOnId) : undefined}
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
