'use client';

import * as React from 'react';
import { Sparkle } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/utils';
import { AssistantPanel } from './assistant-panel';

interface AssistantLauncherProps {
  /**
   * `above-book-bar` clears `MobileBookBar` (`fixed inset-x-3 bottom-3 z-30`)
   * on `/rooms/[slug]` below `lg`, where it would otherwise sit underneath
   * it. Every other guest route uses the default corner.
   */
  mobileOffset?: 'default' | 'above-book-bar';
}

/**
 * The one persistent way into the AI room finder — mounted explicitly on
 * `/`, `/rooms`, `/rooms/[slug]`, `/trips` and `/platform`, never inside the
 * booking flow or `/admin`. The control itself never portals: only the open
 * panel does, so it can sit above the frosted header's backdrop-filter
 * (see `components/site/modal.tsx` for why that matters for `fixed`
 * descendants).
 */
export function AssistantLauncher({ mobileOffset = 'default' }: AssistantLauncherProps) {
  const [open, setOpen] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const close = React.useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Find a room by voice or description"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'bg-primary fixed right-3 z-40 flex size-20 scale-100 items-center justify-center rounded-full p-2 shadow-soft-lg outline-none transition-[opacity,scale] duration-200 ease-out hover:scale-105 hover:bg-primary-hover active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          mobileOffset === 'above-book-bar'
            ? 'bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:right-6 lg:bottom-6'
            : 'bottom-[calc(0.75rem+env(safe-area-inset-bottom))] sm:right-6 sm:bottom-6',
          open && 'pointer-events-none scale-90 opacity-0',
        )}
      >
        {/* A sparkle, not the orbs: at rest the orbs read as a globe or a
            loading spinner, and a guest had no way to know this was the
            assistant. The sparkle is what "AI" looks like now; the orbs stay
            for the panel's own listening/thinking states, which is the only
            place the motion exception covers.

            A filled primary disc rather than the frosted glass every other
            floating control uses: glass over the light canvas read as just
            another pale circle, and the mark on it barely showed. Reads
            `text-primary-foreground`, not a literal white, so it stays
            legible whatever `--primary` resolves to (ink, lime, or the
            current cyan try). */}
        <Sparkle weight="fill" className="text-primary-foreground size-8" aria-hidden="true" />
      </button>

      <AssistantPanel open={open} onClose={close} mobileOffset={mobileOffset} />
    </>
  );
}
