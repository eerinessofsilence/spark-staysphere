'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Search, Users } from 'lucide-react';
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
  variant?: 'hero' | 'inline';
  submitLabel?: string;
}

export function StaySearchBar({
  criteria,
  filters,
  minDate,
  className,
  variant = 'hero',
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
        'grid gap-3 rounded-3xl border border-border bg-card p-3 shadow-soft sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto_auto]',
        variant === 'hero' && 'sm:p-4',
        className,
      )}
    >
      <Field
        id="stay-check-in"
        label="Check-in"
        icon={<CalendarDays className="size-4" aria-hidden="true" />}
      >
        <input
          id="stay-check-in"
          type="date"
          value={draft.checkIn}
          min={minDate}
          required
          onChange={(event) => onCheckInChange(event.target.value)}
          className="h-6 w-full bg-transparent text-sm font-medium outline-none"
        />
      </Field>

      <Field
        id="stay-check-out"
        label="Check-out"
        icon={<CalendarDays className="size-4" aria-hidden="true" />}
        error={invalid ? 'Check-out must be after check-in.' : undefined}
      >
        <input
          id="stay-check-out"
          type="date"
          value={draft.checkOut}
          min={addOneDay(draft.checkIn)}
          required
          aria-invalid={invalid}
          onChange={(event) =>
            setDraft((current) => ({ ...current, checkOut: event.target.value }))
          }
          className="h-6 w-full bg-transparent text-sm font-medium outline-none"
        />
      </Field>

      <Field id="stay-adults" label="Adults" icon={<Users className="size-4" aria-hidden="true" />}>
        <select
          id="stay-adults"
          value={draft.adults}
          onChange={(event) =>
            setDraft((current) => ({ ...current, adults: Number(event.target.value) }))
          }
          className="h-6 w-full bg-transparent text-sm font-medium outline-none"
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
          onChange={(event) =>
            setDraft((current) => ({ ...current, children: Number(event.target.value) }))
          }
          className="h-6 w-full bg-transparent text-sm font-medium outline-none"
        >
          {[0, 1, 2, 3, 4, 5, 6].map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </Field>

      <button
        type="submit"
        disabled={invalid || isPending}
        className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-cyan px-6 text-sm font-semibold text-ink transition-colors hover:bg-cyan/85 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Search className="size-4" aria-hidden="true" />
        {isPending ? 'Searching…' : submitLabel}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  icon,
  error,
  children,
}: {
  id: string;
  label: string;
  icon?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex min-h-14 flex-col justify-center rounded-2xl border border-border px-3.5 py-2 focus-within:border-cyan-dark',
        error && 'border-danger',
      )}
    >
      <label htmlFor={id} className="eyebrow flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </label>
      <div className="mt-1">{children}</div>
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
