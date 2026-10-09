'use client';

import * as React from 'react';

/**
 * Locks background scroll while `active` — the page behind an open overlay
 * must not scroll under it. Shared by every overlay that does this: `Modal`,
 * the site menu, the guests field, the phone field, and the assistant panel.
 * Callers key it on `rendered` from `useOverlayTransition`, not `open`
 * directly, so the lock holds through the close transition too — otherwise
 * the page behind a closing sheet flashes into view a beat before the sheet
 * has finished sliding off it.
 */
export function useScrollLock(active: boolean): void {
  React.useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}
