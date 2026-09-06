'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { GuestsField } from '@/components/search/guests-field';
import { StayDatesField } from '@/components/search/stay-dates-field';
import type { RoomFilters } from '@/lib/application/catalog-service';
import { buildQuery } from '@/lib/application/search-params';
import type { StayCriteria } from '@/lib/domain/schemas';
import { cn } from '@/lib/utils';

interface StaySearchBarProps {
  criteria: StayCriteria;
  /** Preserved so changing dates from the catalog does not drop active filters. */
  filters?: RoomFilters;
  /** Earliest selectable date, resolved on the server to keep markup stable. */
  minDate: string;
  className?: string;
  submitLabel?: string;
  /** `compact` is the one-line pill that rides in the site header. */
  size?: 'default' | 'compact';
}

export function StaySearchBar({
  criteria,
  filters,
  minDate,
  className,
  submitLabel = 'Search rooms',
  size = 'default',
}: StaySearchBarProps) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<StayCriteria>(criteria);
  const [isPending, startTransition] = React.useTransition();

  // The URL is the source of truth; re-sync when a navigation changes the stay.
  React.useEffect(() => setDraft(criteria), [criteria]);

  // The picker cannot produce an inverted range; this guards a hand-edited URL.
  const invalid = draft.checkOut <= draft.checkIn;

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (invalid) return;
    const query = buildQuery({ criteria: draft, filters });
    startTransition(() => router.push(`/rooms?${query}`));
  };

  // In the header the bar has to read at a glance and fit one row: the labels
  // drop away and the submit collapses to the round magnifier.
  if (size === 'compact') {
    return (
      <form
        onSubmit={onSubmit}
        className={cn('flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-soft', className)}
      >
        <div className="flex items-center divide-x divide-border">
          <StayDatesField
            size="compact"
            checkIn={draft.checkIn}
            checkOut={draft.checkOut}
            minDate={minDate}
            onChange={(dates) => setDraft((current) => ({ ...current, ...dates }))}
          />
          <GuestsField
            id="stay-guests-compact"
            size="compact"
            adults={draft.adults}
            children={draft.children}
            onChange={(guests) => setDraft((current) => ({ ...current, ...guests }))}
          />
        </div>

        <button
          type="submit"
          disabled={invalid || isPending}
          aria-label={submitLabel}
          className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-ink text-[#F7F5F0] transition-colors hover:bg-[#2b2b2b] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <MagnifyingGlassIcon className="size-4" aria-hidden="true" />
          )}
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        // Below `sm` the fields have nothing to tell them apart but a gap of
        // blank card — a hairline between rows reads as one form instead of
        // three loose labels. From `sm` the grid gives fields their own cell,
        // and from `lg` the divider turns sideways for the one-row pill.
        'grid divide-y divide-border rounded-[28px] border border-border bg-card p-2 shadow-soft-lg sm:grid-cols-2 sm:gap-2 sm:divide-y-0 lg:grid-cols-[1.2fr_1.2fr_1fr_auto] lg:rounded-full lg:gap-0 lg:divide-x lg:divide-border',
        className,
      )}
    >
      <StayDatesField
        checkIn={draft.checkIn}
        checkOut={draft.checkOut}
        minDate={minDate}
        onChange={(dates) => setDraft((current) => ({ ...current, ...dates }))}
      />

      <GuestsField
        id="stay-guests"
        adults={draft.adults}
        children={draft.children}
        onChange={(guests) => setDraft((current) => ({ ...current, ...guests }))}
      />

      <div className="flex items-center p-1 pt-3 sm:col-span-2 sm:pt-1 lg:col-span-1 lg:pt-1 lg:pl-3">
        <button
          type="submit"
          disabled={invalid || isPending}
          className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-medium text-[#F7F5F0] transition-colors hover:bg-[#2b2b2b] disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
        >
          <MagnifyingGlassIcon className="size-4" aria-hidden="true" />
          {isPending ? 'Searching…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
