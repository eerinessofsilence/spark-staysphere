'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { iconButton } from '@/lib/ui';
import { useOverlayTransition } from '@/components/site/use-overlay-transition';
import { cn } from '@/lib/utils';

/**
 * The shell every dialog shares: a centred card on a desk, a sheet rising
 * from the bottom edge on a phone.
 *
 * The sheet is the height of what is on it. A dialog holding five menu rows
 * has no business taking a whole screen, and one holding a photograph and a
 * paragraph does not need the empty gap that a full-height panel leaves
 * between its content and the button pinned to the floor. Past 85% of the
 * viewport it stops growing and scrolls inside instead, so a long panel is
 * still bounded. The dates panel and the guest stepper are the same shape at
 * the same inset — a phone only ever has one kind of overlay.
 */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  /**
   * Off when the panel dresses itself — a photograph running edge to edge and
   * its own close control over it. The shell still owns the backdrop, the
   * escape key, the scroll lock, and the portal; it just stops adding a title
   * bar and padding that a picture-led panel has to fight.
   */
  chrome?: boolean;
}

export function Modal({ open, onClose, title, children, className, chrome = true }: ModalProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  // A client component still renders once on the server, where there is no
  // `document.body` to portal into. Only portal after the browser has it.
  const [mounted, setMounted] = React.useState(false);
  const { rendered, visible } = useOverlayTransition(open);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!rendered) return;
    // The page behind the sheet must not scroll under it — held
    // through the close transition too, or the page flashes into view a beat
    // before the sheet has finished sliding off it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [rendered]);

  if (!rendered || !mounted) return null;

  // Rendered on the body: the header's frosted pill has a backdrop filter,
  // and that makes it the containing block for any `fixed` child inside it.
  // `.dark` sits on `<html>`, an ancestor of the body either way, so the
  // portal needs nothing of its own to pick up the scheme.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-foreground sm:items-center sm:p-6">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          // The page behind a dialog is pushed back the way the product frosts
          // anything else: 2px was a hint of a blur rather than a treatment.
          'absolute inset-0 cursor-default bg-ink/40 backdrop-blur-md transition-opacity duration-200',
          visible ? 'opacity-100' : 'opacity-0',
        )}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          // Named properties, not `transition-all`: the panel's own className can
          // change border-radius or width at this breakpoint, and those have no
          // business animating just because the dialog opened. `translate` and
          // `scale` are named individually because Tailwind writes them to
          // those standalone properties — listing `transform` moves nothing.
          'relative flex w-full flex-col overflow-hidden rounded-[28px] border border-border bg-card shadow-soft-lg outline-none transition-[opacity,translate,scale] duration-200 ease-out',
          'max-h-[85dvh] sm:max-h-[88vh] sm:max-w-lg',
          // A phone gets the sheet's own move, sliding up off the bottom edge
          // it is pinned to; a desk's centred card has no edge to come from,
          // so it settles in from a touch smaller and a touch faded instead.
          visible
            ? 'translate-y-0 opacity-100 sm:scale-100'
            : 'translate-y-8 opacity-0 sm:translate-y-0 sm:scale-95',
          className,
        )}
      >
        {chrome ? (
          <>
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <p className="flex-1 pl-1 text-sm font-medium">{title}</p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className={iconButton('light', 'size-10')}
              >
                <XMarkIcon className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto">{children}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
