'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { RoomFilters, SortOrder } from '@/lib/application/catalog-service';
import { buildQuery, type CatalogLayout } from '@/lib/application/search-params';
import type { StayCriteria } from '@/lib/domain/schemas';
import { useT } from '@/lib/i18n/context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const t = useT();
  const router = useRouter();
  const [, startTransition] = React.useTransition();

  const options: { value: SortOrder; label: string }[] = [
    { value: 'recommended', label: t('rooms.recommended') },
    { value: 'price_asc', label: t('rooms.priceLowHigh') },
    { value: 'price_desc', label: t('rooms.priceHighLow') },
    { value: 'area_desc', label: t('rooms.largestFirst') },
  ];

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="room-sort" className="text-sm whitespace-nowrap text-muted-foreground">
        {t('rooms.sortBy')}
      </label>
      <Select
        items={options}
        value={filters.sort}
        onValueChange={(next) => {
          const query = buildQuery({
            criteria,
            filters: { ...filters, sort: (next ?? 'recommended') as SortOrder },
            layout,
          });
          startTransition(() => router.replace(`/rooms?${query}`, { scroll: false }));
        }}
      >
        <SelectTrigger id="room-sort" className="min-h-11 rounded-full border border-border bg-card py-1 pr-3 pl-4 text-sm font-medium">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-2xl border border-border bg-card p-1.5 shadow-soft ring-0">
          {options.map((option) => (
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
    </div>
  );
}
