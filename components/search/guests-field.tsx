'use client';

import * as React from 'react';
import { MinusIcon, PlusIcon, UsersIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { fieldClass, iconButton, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';

/**
 * One "Guests" field that opens a stepper panel, replacing a pair of native
 * `<select>` boxes whose spin-button chrome differed by browser and OS.
 * Counts commit immediately on each +/- press; there is no draft state to
 * confirm, so "Done" is just a close affordance.
 *
 * Below `sm` the panel is a full-screen take-over — a small anchored popover
 * has no good spot on a narrow screen and gets clipped or crowded. This
 * mirrors how Airbnb's own mobile guest picker behaves: opaque, full height,
 * a close button top-left, the action pinned to the bottom.
 */

const MIN_ADULTS = 1;
const MAX_ADULTS = 8;
const MIN_CHILDREN = 0;
const MAX_CHILDREN = 6;

interface GuestsFieldProps {
  id?: string;
  adults: number;
  children: number;
  onChange: (next: { adults: number; children: number }) => void;
  /** `bar` sits inside the search pill (label above value, no box); `stacked` is a boxed field for the booking flow. */
  variant?: 'bar' | 'stacked';
  /** `compact` drops the label to one line so the bar fits the site header. */
  size?: 'default' | 'compact';
  error?: string;
}

export function GuestsField({
  id = 'guests',
  adults,
  children,
  onChange,
  variant = 'bar',
  size = 'default',
  error,
}: GuestsFieldProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // The mobile panel is a full-screen sheet; stop the page behind it scrolling.
  React.useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const summary = `${adults} adult${adults === 1 ? '' : 's'}${
    children > 0 ? ` · ${children} child${children === 1 ? '' : 'ren'}` : ''
  }`;

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Guests"
      className={cn(
        'fixed inset-0 z-50 flex flex-col bg-card',
        'sm:absolute sm:inset-auto sm:top-full sm:left-0 sm:z-50 sm:mt-2 sm:w-72 sm:max-w-[calc(100vw-2rem)] sm:rounded-3xl sm:border sm:border-border sm:shadow-soft-lg',
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:hidden">
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className={iconButton('light', 'size-10')}
        >
          <XMarkIcon className="size-4" aria-hidden="true" />
        </button>
        <p className="text-sm font-medium">Guests</p>
        <span className="size-10" aria-hidden="true" />
      </div>

      <div className="flex-1 divide-y divide-border overflow-y-auto px-4 pt-2 sm:flex-none sm:p-4">
        <Stepper
          label="Adults"
          hint="Ages 13+"
          value={adults}
          min={MIN_ADULTS}
          max={MAX_ADULTS}
          onChange={(next) => onChange({ adults: next, children })}
        />
        <Stepper
          label="Children"
          hint="Ages 2–12"
          value={children}
          min={MIN_CHILDREN}
          max={MAX_CHILDREN}
          onChange={(next) => onChange({ adults, children: next })}
        />
      </div>

      <div className="border-t border-border p-4 sm:flex sm:justify-end sm:border-t-0 sm:px-4 sm:pt-0 sm:pb-4">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={pill('primary', 'min-h-12 w-full sm:min-h-10 sm:w-auto sm:px-5')}
        >
          Done
        </button>
      </div>
    </div>
  );

  if (variant === 'stacked') {
    return (
      <div className="relative">
        <span className="mb-1.5 block text-sm text-muted-foreground">Guests</span>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            fieldClass,
            'flex cursor-pointer items-center justify-between gap-2 text-left',
            open && 'border-accent',
            error && 'border-danger',
          )}
        >
          <span className="font-medium">{summary}</span>
          <UsersIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        </button>
        {error ? (
          <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
            {error}
          </p>
        ) : null}
        {open ? panel : null}
      </div>
    );
  }

  if (size === 'compact') {
    return (
      <div className="relative flex items-center">
        <button
          ref={triggerRef}
          id={id}
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`Guests, ${summary}. Choose your guests.`}
          className={cn(
            'flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors hover:bg-stone/60',
            open && 'bg-stone/60',
          )}
        >
          <UsersIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {summary}
        </button>
        {open ? panel : null}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-14 flex-col justify-center rounded-3xl px-4 py-2 lg:rounded-none">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="cursor-pointer text-left"
      >
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <UsersIcon className="size-3.5" aria-hidden="true" />
          Guests
        </span>
        <span className="mt-0.5 block text-[15px] font-medium">{summary}</span>
      </button>
      {open ? panel : null}
    </div>
  );
}

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Decrease ${label.toLowerCase()}`}
          className={iconButton('light', 'size-9')}
        >
          <MinusIcon className="size-3.5" aria-hidden="true" />
        </button>
        <span className="w-4 text-center text-sm font-medium tabular-nums" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Increase ${label.toLowerCase()}`}
          className={iconButton('light', 'size-9')}
        >
          <PlusIcon className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
