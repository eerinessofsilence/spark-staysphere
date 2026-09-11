'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { DayPicker, type DayButton, type Modifiers } from 'react-day-picker';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { addDays, differenceInCalendarDays, format, isAfter, parseISO } from 'date-fns';
import { formatDateShort, formatNights } from '@/lib/formatting';
import { fieldClass, iconButton, pill } from '@/lib/ui';
import { useOverlayTransition } from '@/components/site/use-overlay-transition';
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
  /** `compact` drops the label to one line so the bar fits the site header. */
  size?: 'default' | 'compact';
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
  const Icon = orientation === 'left' ? ChevronLeftIcon : ChevronRightIcon;
  return <Icon className={cn('size-4', className)} aria-hidden="true" />;
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
        edge && 'bg-primary font-medium text-primary-foreground hover:bg-primary',
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
  size = 'default',
  error,
}: StayDatesFieldProps) {
  const [open, setOpen] = React.useState(false);
  // This panel cannot be a `Modal` — it is anchored under the field it belongs
  // to rather than centred — but it is still an overlay and arrives like one.
  const { rendered, visible } = useOverlayTransition(open);
  const [editing, setEditing] = React.useState<DateField>('checkIn');
  const checkInRef = React.useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = React.useState<{ from?: Date; to?: Date }>(() => ({
    from: parseISO(checkIn),
    to: parseISO(checkOut),
  }));
  const [hovered, setHovered] = React.useState<Date | undefined>(undefined);
  const [months, setMonths] = React.useState(1);
  const [anchor, setAnchor] = React.useState<DOMRect | null>(null);

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
  const rangeSummary =
    draft.from && draft.to
      ? `${formatDateShort(format(draft.from, ISO_FORMAT))} → ${formatDateShort(format(draft.to, ISO_FORMAT))}`
      : null;
  const prompt = draft.from ? 'Pick your check-out date.' : 'Pick your check-in date.';

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
        // Named properties only: `transition-all` here would also animate the
        // fixed offsets, and the panel re-anchors on every scroll frame.
        // `translate`, not `transform` — that is the property Tailwind sets.
        'transition-[opacity,translate] duration-200 ease-out',
        visible
          ? 'translate-y-0 opacity-100'
          : // Up from the bottom edge it is pinned to on a phone; a short drop
            // out of the field it belongs to on a desk.
            'pointer-events-none translate-y-8 opacity-0 sm:-translate-y-1',
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
          weekday: 'flex-1 pb-2 text-xs font-normal text-muted-foreground',
          week: 'flex w-full',
          // The circles already fade; without this the band behind them snaps.
          day: 'relative flex-1 p-0 text-center transition-colors',
          range_start: 'rounded-l-full bg-stone',
          range_end: 'rounded-r-full bg-stone',
          range_middle: 'bg-stone',
          disabled: 'text-muted-foreground/45',
          hidden: 'invisible',
        }}
        components={CALENDAR_COMPONENTS}
      />

      <div className="mt-4 border-t border-border pt-4">
        {/* The dates are what this whole panel is for — the same emphasis
            the stay summary gets everywhere else it appears, not a caption
            sharing a row with the buttons. */}
        <div role="status" className="text-center">
          {rangeSummary ? (
            <>
              <p className="text-display text-xl sm:text-2xl">{rangeSummary}</p>
              <p className="mt-1 text-sm text-muted-foreground">{formatNights(nights)}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{prompt}</p>
          )}
        </div>

        <div className="mt-4 flex justify-center gap-2">
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
              'flex cursor-pointer items-center justify-between gap-2 text-left',
              active && 'border-accent',
              error && field === 'checkOut' && 'border-danger',
            )}
          >
            <span className="font-medium">{display}</span>
            <CalendarIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          </button>
          {error && field === 'checkOut' ? (
            <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
              {error}
            </p>
          ) : null}
        </div>
      );
    }

    if (size === 'compact') {
      return (
        <button
          ref={ref}
          type="button"
          onClick={() => openFor(field)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${label}, ${display}. Choose your dates.`}
          className={cn(
            'flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors hover:bg-stone/60',
            active && 'bg-stone/60',
          )}
        >
          <CalendarIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {display}
        </button>
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
          'flex min-h-14 cursor-pointer flex-col justify-center px-4 py-2 text-left transition-colors',
          // Square, always. A rounded field meeting a hairline draws the line
          // curving up at both ends, which is what made the stacked fields
          // look like half-drawn boxes.
          'rounded-none',
          // Both ends of one range, side by side with a rule between them
          // rather than stacked as if they were unrelated fields. From `lg`
          // the form's own `divide-x` draws every rule instead.
          field === 'checkOut' && 'border-l border-border lg:border-l-0',
          active && 'bg-stone/60',
        )}
      >
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarIcon className="size-3.5" aria-hidden="true" />
          {label}
        </span>
        <span className="mt-0.5 text-base font-medium">{display}</span>
      </button>
    );
  };

  return (
    <>
      {trigger('checkIn', 'Check-in', checkIn)}
      {trigger('checkOut', 'Check-out', checkOut)}
      {rendered
        ? // On the body, not in place: the header's frosted pill has a backdrop
          // filter, which would make it the containing block for these.
          createPortal(
            <div className="text-foreground">
              {/* Dims the page behind the mobile sheet only. */}
              <div
                aria-hidden="true"
                className={cn(
                  'fixed inset-0 z-40 bg-ink/20 transition-opacity duration-200 sm:hidden',
                  visible ? 'opacity-100' : 'opacity-0',
                )}
              />
              {panel}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
