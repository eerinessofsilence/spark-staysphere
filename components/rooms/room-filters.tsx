'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal, X } from '@phosphor-icons/react/dist/ssr';
import type { CatalogFacets, RoomFilters as Filters } from '@/lib/application/catalog-service';
import { defaultRoomFilters } from '@/lib/application/catalog-service';
import { activeFilterCount, buildQuery, filtersAreDefault } from '@/lib/application/search-params';
import type { RoomType, StayCriteria } from '@/lib/domain/schemas';
import { bedLabels, categoryLabels, formatMoney, viewLabels } from '@/lib/formatting';
import { fieldClass, pill } from '@/lib/ui';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface RoomFiltersProps {
  criteria: StayCriteria;
  filters: Filters;
  facets: CatalogFacets;
  resultCount: number;
}

export function RoomFiltersPanel({ criteria, filters, facets, resultCount }: RoomFiltersProps) {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const count = activeFilterCount(filters);

  return (
    <>
      {/* Mobile: filters live in a bottom sheet so the results stay in view. */}
      <div className="lg:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger
            render={
              <button type="button" className={pill('secondary', 'w-full shadow-soft')}>
                <SlidersHorizontal weight="fill" className="size-4" aria-hidden="true" />
                Filters
                {count > 0 ? (
                  <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-[#F7F5F0]">
                    {count}
                  </span>
                ) : null}
              </button>
            }
          />
          <SheetContent side="bottom" className="max-h-[85vh] gap-0 rounded-t-[28px] border-t border-border">
            <SheetHeader className="border-b border-border">
              <SheetTitle className="text-display text-xl font-medium">Filter rooms</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto px-4 pb-4">
              <FilterControls idPrefix="sheet" criteria={criteria} filters={filters} facets={facets} />
            </div>
            <div className="border-t border-border bg-card p-4">
              <button type="button" onClick={() => setSheetOpen(false)} className={pill('primary', 'w-full')}>
                Show {resultCount} {resultCount === 1 ? 'room' : 'rooms'}
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <aside
        aria-label="Room filters"
        className="hidden lg:sticky lg:top-28 lg:block lg:h-fit lg:rounded-[28px] lg:bg-card lg:p-6 lg:shadow-soft"
      >
        <FilterControls idPrefix="side" criteria={criteria} filters={filters} facets={facets} />
      </aside>
    </>
  );
}

interface FilterControlsProps {
  idPrefix: string;
  criteria: StayCriteria;
  filters: Filters;
  facets: CatalogFacets;
}

function FilterControls({ idPrefix, criteria, filters, facets }: FilterControlsProps) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  const [priceDraft, setPriceDraft] = React.useState<[number, number]>([
    filters.minPrice ?? facets.priceRange.min,
    filters.maxPrice ?? facets.priceRange.max,
  ]);

  React.useEffect(() => {
    setPriceDraft([filters.minPrice ?? facets.priceRange.min, filters.maxPrice ?? facets.priceRange.max]);
  }, [filters.minPrice, filters.maxPrice, facets.priceRange.min, facets.priceRange.max]);

  const apply = React.useCallback(
    (next: Filters) => {
      const query = buildQuery({ criteria, filters: next });
      startTransition(() => router.replace(`/rooms?${query}`, { scroll: false }));
    },
    [criteria, router],
  );

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];

  const isDefault = filtersAreDefault(filters);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-center justify-between">
        <h2 className="text-display text-xl font-medium">Filters</h2>
        <button
          type="button"
          disabled={isDefault}
          onClick={() => apply({ ...defaultRoomFilters, sort: filters.sort })}
          className={pill('ghost', 'h-10 px-3 text-accent-strong disabled:text-muted-foreground')}
        >
          <X weight="bold" className="size-3.5" aria-hidden="true" />
          Reset
        </button>
      </div>

      <Group title="Nightly budget" id={`${idPrefix}-budget`}>
        <p className="mb-4 text-sm text-muted-foreground">
          {formatMoney(priceDraft[0], 'EUR')} – {formatMoney(priceDraft[1], 'EUR')} a night
        </p>
        <Slider
          value={priceDraft}
          min={facets.priceRange.min}
          max={facets.priceRange.max}
          step={5}
          aria-label="Nightly budget range"
          onValueChange={(value) => {
            if (Array.isArray(value)) setPriceDraft([value[0] ?? 0, value[1] ?? 0]);
          }}
          onValueCommitted={(value) => {
            if (!Array.isArray(value)) return;
            const [min, max] = value;
            apply({
              ...filters,
              minPrice: min === facets.priceRange.min ? null : (min ?? null),
              maxPrice: max === facets.priceRange.max ? null : (max ?? null),
            });
          }}
        />
      </Group>

      <Group title="Room type" id={`${idPrefix}-type`}>
        <Chips
          options={facets.categories.map((category) => ({ value: category, label: categoryLabels[category] }))}
          selected={filters.categories}
          onToggle={(value) => apply({ ...filters, categories: toggle(filters.categories, value) })}
        />
      </Group>

      <Group title="View" id={`${idPrefix}-view`}>
        <Chips
          options={facets.views.map((view) => ({ value: view, label: viewLabels[view] }))}
          selected={filters.views}
          onToggle={(value) => apply({ ...filters, views: toggle(filters.views, value as RoomType['view']) })}
        />
      </Group>

      <Group title="Beds" id={`${idPrefix}-beds`}>
        <Chips
          options={facets.bedTypes.map((bed) => ({ value: bed, label: bedLabels[bed] }))}
          selected={filters.bedTypes}
          onToggle={(value) => apply({ ...filters, bedTypes: toggle(filters.bedTypes, value as RoomType['bedType']) })}
        />
      </Group>

      <Group title="Space and floor" id={`${idPrefix}-space`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            id={`${idPrefix}-min-area`}
            label="Minimum area"
            value={filters.minArea === null ? '' : String(filters.minArea)}
            onChange={(value) => apply({ ...filters, minArea: value === '' ? null : Number(value) })}
            options={[
              { value: '', label: 'Any size' },
              { value: '40', label: '40 m² or more' },
              { value: '60', label: '60 m² or more' },
              { value: '80', label: '80 m² or more' },
            ]}
          />
          <SelectField
            id={`${idPrefix}-min-floor`}
            label="Floor"
            value={filters.minFloor === null ? '' : String(filters.minFloor)}
            onChange={(value) => apply({ ...filters, minFloor: value === '' ? null : Number(value) })}
            options={[
              { value: '', label: 'Any floor' },
              { value: '1', label: '1st floor and up' },
              { value: '4', label: '4th floor and up' },
              { value: '6', label: '6th floor and up' },
            ]}
          />
        </div>
      </Group>

      <Group title="Amenities" id={`${idPrefix}-amenities`}>
        <Chips
          options={facets.amenities.map((amenity) => ({ value: amenity, label: amenity }))}
          selected={filters.amenities}
          onToggle={(value) => apply({ ...filters, amenities: toggle(filters.amenities, value) })}
        />
      </Group>

      <Group title="Availability" id={`${idPrefix}-availability`}>
        <label
          htmlFor={`${idPrefix}-hide-sold-out`}
          className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm"
        >
          Hide sold-out rooms
          <Switch
            id={`${idPrefix}-hide-sold-out`}
            checked={!filters.includeSoldOut}
            onCheckedChange={(checked) => apply({ ...filters, includeSoldOut: !checked })}
            className="h-6 w-11 shrink-0"
          />
        </label>
      </Group>
    </div>
  );
}

function Group({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-labelledby={id}>
      <h3 id={id} className="mb-3 font-sans text-sm font-medium tracking-normal">
        {title}
      </h3>
      {children}
    </div>
  );
}

/** Toggle chips: pressed state is carried by aria-pressed and by the ink fill. */
function Chips<T extends string>({
  options,
  selected,
  onToggle,
}: {
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  if (options.length === 0) return <p className="text-sm text-muted-foreground">Nothing to filter by yet.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const pressed = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onToggle(option.value)}
            className={cn(
              'inline-flex min-h-10 items-center rounded-full border px-3.5 text-sm transition-colors',
              pressed ? 'border-ink bg-ink text-[#F7F5F0]' : 'border-border bg-card hover:bg-stone',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs text-muted-foreground">
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
