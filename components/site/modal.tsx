'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { iconButton } from '@/lib/ui';
import { cn } from '@/lib/utils';

/**
 * The shell every header dialog shares: a centred card on a desk, a
 * full-screen sheet on a phone. Same treatment as the guest stepper, so the
 * product only ever has one kind of overlay.
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

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    // The page behind a full-screen sheet must not scroll under it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  // Rendered on the body: the header's frosted pill has a backdrop filter,
  // and that makes it the containing block for any `fixed` child inside it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-center sm:items-center sm:p-6">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative flex w-full flex-col overflow-hidden bg-card outline-none',
          'sm:max-h-[88vh] sm:max-w-lg sm:rounded-[28px] sm:border sm:border-border sm:shadow-soft-lg',
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
