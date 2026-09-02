'use client';

import * as React from 'react';
import { DayPicker, type DayButton, type Modifiers } from 'react-day-picker';
import { CalendarBlank, CaretLeft, CaretRight } from '@phosphor-icons/react/dist/ssr';
import { addDays, differenceInCalendarDays, format, isAfter, parseISO } from 'date-fns';
import { formatDateShort, formatNights } from '@/lib/formatting';
import { fieldClass, iconButton, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';

/**
 * The stay's check-in and check-out, picked as one range in a single panel —
 * the pattern every guest already knows from the large travel sites. It
 * replaces two `input[type=date]`, which rendered as a different control in
 * every browser and could not show the range, the nights, or the sold-out days.
 *
 * Selection follows the same rules as those sites: the first click sets
 * check-in and arms check-out, a later day closes the range, and an earlier
 * day starts a new one. Hovering previews the range before it is committed.
 */

const ISO_FORMAT = 'yyyy-MM-dd';
/** Panel width at two months. Kept here because the fixed position maths needs it. */
const PANEL_WIDTH = 660;
const VIEWPORT_MARGIN = 12;

type DateField = 'checkIn' | 'checkOut';

interface StayDatesFieldProps {
  checkIn: string;
  checkOut: string;
  /** Earliest selectable day, resolved on the server so markup stays stable. */
  minDate: string;
  onChange: (next: { checkIn: string; checkOut: string }) => void;
  /**
   * `bar` sits inside the search pill (label above value, no box);
   * `stacked` is a pair of boxed fields for the booking flow.
   */
  variant?: 'bar' | 'stacked';
  error?: string;
}

/**
 * Both are declared once, at module scope: a component identity that changes
 * between renders remounts every day button, and a button that is replaced
 * between pointerdown and pointerup never fires a click.
 */
function CalendarChevron({
  orientation,
  className,
}: {
  orientation?: 'left' | 'right' | 'up' | 'down';
  className?: string;
}) {
  const Icon = orientation === 'left' ? CaretLeft : CaretRight;
  return <Icon weight="bold" className={cn('size-4', className)} aria-hidden="true" />;
}

function CalendarDayButton({
  day,
  modifiers,
  className,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const edge = modifiers.range_start || modifiers.range_end || (modifiers.selected && !modifiers.range_middle);
  return (
    <button
      {...props}
      type="button"
      className={cn(
        'relative flex aspect-square w-full items-center justify-center rounded-full text-sm transition-colors',
        'hover:bg-stone',
        modifiers.today &&
          !edge &&
          'font-medium after:absolute after:bottom-1.5 after:size-1 after:rounded-full after:bg-accent',
        edge && 'bg-ink font-medium text-[#F7F5F0] hover:bg-ink',
        modifiers.disabled && 'text-muted-foreground/45 line-through hover:bg-transparent',
        className,
      )}
      aria-label={formatDateShort(format(day.date, ISO_FORMAT))}
    />
  );
}

const CALENDAR_COMPONENTS = { Chevron: CalendarChevron, DayButton: CalendarDayButton };

export function StayDatesField({
  checkIn,
  checkOut,
  minDate,
  onChange,
  variant = 'bar',
  error,
}: StayDatesFieldProps) {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DateField>('checkIn');
  const [draft, setDraft] = React.useState<{ from?: Date; to?: Date }>(() => ({
    from: parseISO(checkIn),
    to: parseISO(checkOut),
  }));
  const [hovered, setHovered] = React.useState<Date | undefined>(undefined);
  const [months, setMonths] = React.useState(1);
  const [anchor, setAnchor] = React.useState<DOMRect | null>(null);

  const checkInRef = React.useRef<HTMLButtonElement>(null);
  const checkOutRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const min = parseISO(minDate);

  // The URL owns the stay; re-sync whenever a navigation changes it.
  React.useEffect(() => {
    setDraft({ from: parseISO(checkIn), to: parseISO(checkOut) });
  }, [checkIn, checkOut]);

  // Two months side by side once there is room for them.
  React.useEffect(() => {
    const query = window.matchMedia('(min-width: 640px)');
    const apply = () => setMonths(query.matches ? 2 : 1);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  // The panel is fixed-positioned so no ancestor's overflow can clip it.
  React.useEffect(() => {
    if (!open) return;
    const track = () => {
      const trigger = editing === 'checkOut' ? checkOutRef.current : checkInRef.current;
      setAnchor(trigger?.getBoundingClientRect() ?? null);
    };
    track();
    window.addEventListener('resize', track);
    window.addEventListener('scroll', track, true);
    return () => {
      window.removeEventListener('resize', track);
      window.removeEventListener('scroll', track, true);
    };
  }, [open, editing]);

  // Dismiss on outside pointer or Escape, and hand focus back to the trigger.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        panelRef.current?.contains(target) ||
        checkInRef.current?.contains(target) ||
        checkOutRef.current?.contains(target)
      ) {
        return;
      }
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
      (editing === 'checkOut' ? checkOutRef : checkInRef).current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `close` is redeclared each render.
  }, [open, editing, checkIn, checkOut]);

  function close() {
    setOpen(false);
    setHovered(undefined);
    // An unfinished range is discarded: the stay always has both ends.
    setDraft({ from: parseISO(checkIn), to: parseISO(checkOut) });
  }

  function openFor(field: DateField) {
    setEditing(field);
    setHovered(undefined);
    if (field === 'checkOut') setDraft((current) => ({ from: current.from, to: undefined }));
    setOpen(true);
  }

  function selectDay(day: Date, modifiers: Modifiers) {
    if (modifiers.disabled) return;
    const { from, to } = draft;
    // A later day closes the range; anything else starts a new one.
    const closesRange = from && isAfter(day, from) && (editing === 'checkOut' || !to);
    if (closesRange && from) {
      setDraft({ from, to: day });
      setHovered(undefined);
      onChange({ checkIn: format(from, ISO_FORMAT), checkOut: format(day, ISO_FORMAT) });
      setOpen(false);
      return;
    }
    setDraft({ from: day, to: undefined });
    setEditing('checkOut');
  }

  function clear() {
    setDraft({ from: undefined, to: undefined });
    setEditing('checkIn');
    setHovered(undefined);
  }

  // Preview the nights between the armed check-in and the day under the cursor.
  const previewing = draft.from && !draft.to && hovered && isAfter(hovered, draft.from);
  const previewMiddle =
    previewing && draft.from && hovered && differenceInCalendarDays(hovered, draft.from) > 1
      ? { from: addDays(draft.from, 1), to: addDays(hovered, -1) }
      : [];
  const previewEnd = previewing && hovered ? hovered : [];

  const nights = draft.from && draft.to ? differenceInCalendarDays(draft.to, draft.from) : 0;
  const summary =
    draft.from && draft.to
      ? `${formatNights(nights)} · ${formatDateShort(format(draft.from, ISO_FORMAT))} → ${formatDateShort(
          format(draft.to, ISO_FORMAT),
        )}`
      : draft.from
        ? 'Pick your check-out date.'
        : 'Pick your check-in date.';

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Choose your dates"
      className={cn(
        'z-50 rounded-[28px] border border-border bg-card p-4 shadow-soft-lg sm:p-5',
        // Mobile: a sheet pinned to the bottom of the viewport.
        'fixed inset-x-3 bottom-3 max-h-[85dvh] overflow-y-auto',
        // Desktop: anchored under the field it was opened from.
        'sm:inset-x-auto sm:bottom-auto sm:w-[660px] sm:overflow-visible sm:top-(--panel-top) sm:left-(--panel-left)',
      )}
      style={
        anchor
          ? {
              // Overridden below `sm` by the inset classes above.
              '--panel-top': `${anchor.bottom + 10}px`,
              '--panel-left': `${Math.min(
                Math.max(VIEWPORT_MARGIN, anchor.left),
                Math.max(VIEWPORT_MARGIN, window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN),
              )}px`,
            } as React.CSSProperties
          : undefined
      }
    >
      <DayPicker
        mode="range"
        selected={draft.from ? { from: draft.from, to: draft.to } : undefined}
        numberOfMonths={months}
        showOutsideDays={false}
        weekStartsOn={1}
        fixedWeeks
        defaultMonth={draft.from ?? min}
        startMonth={min}
        disabled={{ before: min }}
        onSelect={(_range, day, modifiers) => selectDay(day, modifiers)}
        onDayMouseEnter={(day) => setHovered(day)}
        onDayMouseLeave={() => setHovered(undefined)}
        modifiers={{ preview_middle: previewMiddle, preview_end: previewEnd }}
        modifiersClassNames={{
          preview_middle: 'bg-stone/55',
          preview_end: 'rounded-r-full bg-stone/55',
        }}
        classNames={{
          root: 'relative w-full',
          months: 'flex flex-col gap-6 sm:flex-row sm:gap-8',
          month: 'w-full sm:w-[288px]',
          nav: 'absolute inset-x-0 top-0 z-10 flex items-center justify-between',
          button_previous: iconButton('light', 'size-9'),
          button_next: iconButton('light', 'size-9'),
          month_caption: 'flex h-9 items-center justify-center',
          caption_label: 'text-display text-base',
          month_grid: 'mt-3 w-full border-collapse',
          weekdays: 'flex',
          weekday: 'flex-1 pb-2 text-[11px] font-normal text-muted-foreground',
          week: 'flex w-full',
          day: 'relative flex-1 p-0 text-center',
          range_start: 'rounded-l-full bg-stone',
          range_end: 'rounded-r-full bg-stone',
          range_middle: 'bg-stone',
          disabled: 'text-muted-foreground/45',
          hidden: 'invisible',
        }}
        components={CALENDAR_COMPONENTS}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p role="status" className="text-sm text-muted-foreground">
          {summary}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={clear} className={pill('ghost', 'min-h-10 px-4')}>
            Clear dates
          </button>
          <button type="button" onClick={close} className={pill('primary', 'min-h-10 px-5')}>
            Done
          </button>
        </div>
      </div>
    </div>
  );

  const trigger = (field: DateField, label: string, value: string) => {
    const active = open && editing === field;
    const ref = field === 'checkIn' ? checkInRef : checkOutRef;
    const display = formatDateShort(value);

    if (variant === 'stacked') {
      return (
        <div>
          <span className="mb-1.5 block text-sm text-muted-foreground">{label}</span>
          <button
            ref={ref}
            type="button"
            onClick={() => openFor(field)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={`${label}, ${display}. Choose your dates.`}
            className={cn(
              fieldClass,
              'flex items-center justify-between gap-2 text-left',
              active && 'border-accent',
              error && field === 'checkOut' && 'border-danger',
            )}
          >
            <span className="font-medium">{display}</span>
            <CalendarBlank weight="fill" className="size-4 text-muted-foreground" aria-hidden="true" />
          </button>
          {error && field === 'checkOut' ? (
            <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
              {error}
            </p>
          ) : null}
        </div>
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => openFor(field)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}, ${display}. Choose your dates.`}
        className={cn(
          'flex min-h-14 flex-col justify-center rounded-3xl px-4 py-2 text-left transition-colors lg:rounded-none',
          active && 'bg-stone/60',
        )}
      >
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarBlank weight="fill" className="size-3.5" aria-hidden="true" />
          {label}
        </span>
        <span className="mt-0.5 text-[15px] font-medium">{display}</span>
      </button>
    );
  };

  return (
    <>
      {trigger('checkIn', 'Check-in', checkIn)}
      {trigger('checkOut', 'Check-out', checkOut)}
      {open ? (
        <>
          {/* Dims the page behind the mobile sheet only. */}
          <div className="fixed inset-0 z-40 bg-ink/20 sm:hidden" aria-hidden="true" />
          {panel}
        </>
      ) : null}
    </>
  );
}
