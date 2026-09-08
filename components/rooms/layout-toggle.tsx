'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Bars3Icon, Squares2X2Icon } from '@heroicons/react/24/outline';
import type { RoomFilters } from '@/lib/application/catalog-service';
import { buildQuery, type CatalogLayout } from '@/lib/application/search-params';
import type { StayCriteria } from '@/lib/domain/schemas';
import { cn } from '@/lib/utils';

interface LayoutToggleProps {
  criteria: StayCriteria;
  filters: RoomFilters;
  layout: CatalogLayout;
}

const options: { value: CatalogLayout; label: string; icon: typeof Bars3Icon }[] = [
  { value: 'grid', label: 'Grid', icon: Squares2X2Icon },
  { value: 'list', label: 'List', icon: Bars3Icon },
];

/**
 * Grid or list, as two segments of one control rather than two buttons — the
 * shape says they are the same setting in two positions.
 *
 * It writes to the URL like the sort does, so the choice survives a filter
 * change, a reload and a shared link, and the server renders the catalog in
 * the shape it was asked for rather than the page rearranging itself after
 * hydration.
 */
export function LayoutToggle({ criteria, filters, layout }: LayoutToggleProps) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();

  const select = (next: CatalogLayout) => {
    if (next === layout) return;
    const query = buildQuery({ criteria, filters, layout: next });
    startTransition(() => router.replace(`/rooms?${query}`, { scroll: false }));
  };

  return (
    <div
      role="group"
      aria-label="Result layout"
      className="flex items-center gap-1 rounded-full border border-border bg-card p-1"
    >
      {options.map((option) => {
        const active = option.value === layout;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => select(option.value)}
            aria-pressed={active}
            className={cn(
              'inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors',
              active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-stone',
            )}
          >
            <option.icon className="size-4" aria-hidden="true" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
