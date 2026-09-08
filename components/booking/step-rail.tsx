'use client';

import * as React from 'react';
import { CheckIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface StepRailProps {
  steps: readonly { id: string; label: string }[];
  /** Index of the step the guest is on. */
  current: number;
  /** Only ever called for a step already behind the guest. */
  onSelect: (index: number) => void;
  className?: string;
}

/**
 * The booking flow's progress, read as a sequence rather than a row of chips:
 * a numbered mark per step, an arrow between each pair to say which way the
 * flow runs, and a plain "Step 3 of 6" above it for the position itself.
 *
 * A step behind the guest is a real control — it carries its ticked mark and
 * goes back on click. One ahead is inert: nothing in this flow can be reached
 * before the steps it prices depend on.
 *
 * Only the current step keeps its label on a phone; six labels do not fit a
 * 390px screen, and the numbers plus arrows still say what the rail is. The
 * rail scrolls sideways under that, and the current step is scrolled into
 * view as it changes so the guest never has to find it.
 */
export function StepRail({ steps, current, onSelect, className }: StepRailProps) {
  const currentRef = React.useRef<HTMLLIElement>(null);

  React.useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [current]);

  return (
    <nav aria-label="Booking steps" className={className}>
      <p className="text-sm text-muted-foreground">
        Step {current + 1} of {steps.length}
      </p>

      <ol className="-mx-3 mt-2 flex items-center gap-1 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {steps.map((entry, index) => {
          const state = index === current ? 'current' : index < current ? 'done' : 'todo';

          return (
            <li
              key={entry.id}
              ref={state === 'current' ? currentRef : undefined}
              className="flex shrink-0 items-center gap-1"
            >
              {index > 0 ? (
                <ChevronRightIcon
                  className="size-4 shrink-0 text-muted-foreground/60"
                  aria-hidden="true"
                />
              ) : null}

              <button
                type="button"
                aria-current={state === 'current' ? 'step' : undefined}
                disabled={state !== 'done'}
                onClick={() => onSelect(index)}
                className={cn(
                  'flex min-h-11 items-center gap-2 rounded-full pr-3 pl-1.5 text-sm transition-colors',
                  state === 'current' && 'font-medium text-foreground',
                  state === 'done' && 'cursor-pointer text-foreground hover:bg-stone',
                  state === 'todo' && 'text-muted-foreground',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold',
                    state === 'current' && 'bg-primary text-primary-foreground',
                    state === 'done' && 'bg-accent-soft text-accent-strong',
                    state === 'todo' && 'border border-border text-muted-foreground',
                  )}
                >
                  {state === 'done' ? <CheckIcon className="size-4" /> : index + 1}
                </span>
                <span className={cn(state !== 'current' && 'hidden sm:inline')}>{entry.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
