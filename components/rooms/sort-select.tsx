'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import type { RoomFilters, SortOrder } from '@/lib/application/catalog-service';
import { buildQuery, type CatalogLayout } from '@/lib/application/search-params';
import type { StayCriteria } from '@/lib/domain/schemas';

const options: { value: SortOrder; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'area_desc', label: 'Largest first' },
];

export function SortSelect({
  criteria,
  filters,
  layout,
}: {
  criteria: StayCriteria;
  filters: RoomFilters;
  /** Carried through so re-sorting does not throw the guest back to the grid. */
  layout?: CatalogLayout;
}) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="room-sort" className="text-sm whitespace-nowrap text-muted-foreground">
        Sort by
      </label>
      <div className="relative">
        <select
          id="room-sort"
          value={filters.sort}
          onChange={(event) => {
            const query = buildQuery({
              criteria,
              filters: { ...filters, sort: event.target.value as SortOrder },
              layout,
            });
            startTransition(() => router.replace(`/rooms?${query}`, { scroll: false }));
          }}
          // The browser's own arrow sits at its own padding and size, not ours —
          // drawn off, drop it and place a matching one ourselves.
          className="min-h-11 appearance-none rounded-full border border-border bg-card py-1 pr-9 pl-4 text-sm font-medium"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
