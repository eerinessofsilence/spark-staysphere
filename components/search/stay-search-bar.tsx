'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarBlank, MagnifyingGlass, UsersThree } from '@phosphor-icons/react/dist/ssr';
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
}

export function StaySearchBar({
  criteria,
  filters,
  minDate,
  className,
  submitLabel = 'Search rooms',
}: StaySearchBarProps) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<StayCriteria>(criteria);
  const [isPending, startTransition] = React.useTransition();

  // The URL is the source of truth; re-sync when a navigation changes the stay.
  React.useEffect(() => setDraft(criteria), [criteria]);

  const invalid = draft.checkOut <= draft.checkIn;

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (invalid) return;
    const query = buildQuery({ criteria: draft, filters });
    startTransition(() => router.push(`/rooms?${query}`));
  };

  const onCheckInChange = (value: string) => {
    setDraft((current) => ({
      ...current,
      checkIn: value,
      // Keep the range valid: push check-out out by a night if it collapsed.
      checkOut: current.checkOut <= value ? addOneDay(value) : current.checkOut,
    }));
  };

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        'grid gap-2 rounded-[28px] border border-border bg-card p-2 shadow-soft-lg sm:grid-cols-2 lg:grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr_auto] lg:rounded-full lg:gap-0 lg:divide-x lg:divide-border',
        className,
      )}
    >
      <Field id="stay-check-in" label="Check-in" icon={CalendarBlank}>
        <input
          id="stay-check-in"
          type="date"
          value={draft.checkIn}
          min={minDate}
          required
          onChange={(event) => onCheckInChange(event.target.value)}
          className="h-6 w-full bg-transparent text-[15px] font-medium outline-none"
        />
      </Field>

      <Field
        id="stay-check-out"
        label="Check-out"
        icon={CalendarBlank}
        error={invalid ? 'Check-out must be after check-in.' : undefined}
      >
        <input
          id="stay-check-out"
          type="date"
          value={draft.checkOut}
          min={addOneDay(draft.checkIn)}
          required
          aria-invalid={invalid}
          onChange={(event) => setDraft((current) => ({ ...current, checkOut: event.target.value }))}
          className="h-6 w-full bg-transparent text-[15px] font-medium outline-none"
        />
      </Field>

      <Field id="stay-adults" label="Adults" icon={UsersThree}>
        <select
          id="stay-adults"
          value={draft.adults}
          onChange={(event) => setDraft((current) => ({ ...current, adults: Number(event.target.value) }))}
          className="h-6 w-full bg-transparent text-[15px] font-medium outline-none"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </Field>

      <Field id="stay-children" label="Children">
        <select
          id="stay-children"
          value={draft.children}
          onChange={(event) => setDraft((current) => ({ ...current, children: Number(event.target.value) }))}
          className="h-6 w-full bg-transparent text-[15px] font-medium outline-none"
        >
          {[0, 1, 2, 3, 4, 5, 6].map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex items-center p-1 sm:col-span-2 lg:col-span-1 lg:pl-3">
        <button
          type="submit"
          disabled={invalid || isPending}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-medium text-[#F7F5F0] transition-colors hover:bg-[#2b2b2b] disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
        >
          <MagnifyingGlass weight="bold" className="size-4" aria-hidden="true" />
          {isPending ? 'Searching…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  icon: Icon,
  error,
  children,
}: {
  id: string;
  label: string;
  icon?: typeof CalendarBlank;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex min-h-14 flex-col justify-center rounded-3xl px-4 py-2 lg:rounded-none',
        error && 'text-danger',
      )}
    >
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon ? <Icon weight="fill" className="size-3.5" aria-hidden="true" /> : null}
        {label}
      </label>
      <div className="mt-0.5">{children}</div>
      {error ? (
        <p role="alert" className="mt-0.5 text-[11px] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function addOneDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
