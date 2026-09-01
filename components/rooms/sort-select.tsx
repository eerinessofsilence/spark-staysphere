'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { RoomFilters, SortOrder } from '@/lib/application/catalog-service';
import { buildQuery } from '@/lib/application/search-params';
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
}: {
  criteria: StayCriteria;
  filters: RoomFilters;
}) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="room-sort" className="text-sm whitespace-nowrap text-muted-foreground">
        Sort by
      </label>
      <select
        id="room-sort"
        value={filters.sort}
        onChange={(event) => {
          const query = buildQuery({
            criteria,
            filters: { ...filters, sort: event.target.value as SortOrder },
          });
          startTransition(() => router.replace(`/rooms?${query}`, { scroll: false }));
        }}
        className="min-h-11 rounded-xl border border-border bg-card px-3 text-sm font-medium"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
