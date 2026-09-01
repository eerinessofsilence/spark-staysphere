'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { buildQuery } from '@/lib/application/search-params';
import type { AddOn, Quote, StayCriteria } from '@/lib/domain/schemas';
import { formatMoney, formatPricingUnit } from '@/lib/formatting';
import { Checkbox } from '@/components/ui/checkbox';
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

  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((entry) => entry !== id)
      : [...selected, id];
    const query = buildQuery({ criteria, addOnIds: next });
    startTransition(() => router.replace(`${pathname}?${query}`, { scroll: false }));
  };

  if (enabled.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        No extra services are available for this stay right now.
      </p>
    );
  }

  return (
    <div className={cn('grid gap-3', isPending && 'opacity-70')} aria-busy={isPending}>
      {enabled.map((addOn) => {
        const id = `addon-${addOn.id}`;
        const checked = selected.includes(addOn.id);
        return (
          <label
            key={addOn.id}
            htmlFor={id}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors',
              checked ? 'border-cyan-dark bg-cyan/5' : 'border-border bg-card hover:bg-canvas',
            )}
          >
            <Checkbox
              id={id}
              checked={checked}
              onCheckedChange={() => toggle(addOn.id)}
              className="mt-0.5"
            />
            <span className="flex-1">
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{addOn.name}</span>
                <span className="text-sm font-semibold">
                  {formatMoney(addOn.price, addOn.currency)}{' '}
                  <span className="font-normal text-muted-foreground">
                    {formatPricingUnit(addOn.pricingUnit)}
                  </span>
                </span>
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                {addOn.description}
              </span>
            </span>
          </label>
        );
      })}
      {isPending ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          Repricing your stay…
        </p>
      ) : null}
    </div>
  );
}

/** Line-item view of a server quote. Never recomputed on the client. */
export function QuoteLines({ quote }: { quote: Quote }) {
  const { price } = quote;
  return (
    <dl className="grid gap-2 text-sm">
      <Row
        label={`${formatMoney(price.nightlyPrice, price.currency)} × ${price.nights} ${
          price.nights === 1 ? 'night' : 'nights'
        }`}
        value={formatMoney(price.roomTotal, price.currency)}
      />
      {price.addOnLines.map((line) => (
        <Row
          key={line.addOnId}
          label={`${line.name}${line.quantity > 1 ? ` × ${line.quantity}` : ''}`}
          value={formatMoney(line.total, price.currency)}
        />
      ))}
      <Row
        label="Taxes and city fees"
        value={formatMoney(price.taxesAndFees, price.currency)}
      />
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
