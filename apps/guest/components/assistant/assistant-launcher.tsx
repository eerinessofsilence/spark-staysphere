'use client';

import * as React from 'react';
import { useT } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';
import { AssistantPanel } from './assistant-panel';
import { AssistantLauncherVisual } from './assistant-launcher-visual';

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
 * booking flow. Back-office routes live in the separate PMS app. The control
 * itself never portals: only the open panel does, so it can sit above the
 * frosted header's backdrop-filter
 * (see `components/site/modal.tsx` for why that matters for `fixed`
 * descendants).
 */
export function AssistantLauncher({ mobileOffset = 'default' }: AssistantLauncherProps) {
  const t = useT();
  const [open, setOpen] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const updateVisibility = () => setHidden(document.hidden);
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

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
        aria-label={t('assistant.ariaLabel')}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'fixed right-3 z-40 flex size-20 scale-100 cursor-pointer items-center justify-center rounded-full bg-transparent p-2 outline-none transition-[opacity,scale] duration-200 ease-out active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          mobileOffset === 'above-book-bar'
            ? 'bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:right-6 lg:bottom-6'
            : 'bottom-[calc(0.75rem+env(safe-area-inset-bottom))] sm:right-6 sm:bottom-6',
          open && 'pointer-events-none scale-90 opacity-0',
        )}
      >
        <AssistantLauncherVisual id="guest-assistant-orb" hidden={hidden || open} />
      </button>

      <AssistantPanel open={open} onClose={close} mobileOffset={mobileOffset} />
    </>
  );
}
