'use client';

import * as React from 'react';

/**
 * Keeps `?frame=N` in the address bar in step with the orbit, so the view a
 * guest shares or reloads opens where they left it (`app/page.tsx` reads it
 * back). Written at most once per animation frame, with `replaceState` — a
 * drag must neither flood the history nor re-render the route.
 */
export function useFrameUrlSync(frameIndex: number, enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return;
    const pathname = window.location.pathname;
    const request = requestAnimationFrame(() => {
      if (window.location.pathname !== pathname) return;
      const params = new URLSearchParams(window.location.search);
      params.set('frame', String(frameIndex));
      try {
        window.history.replaceState(window.history.state, '', `${pathname}?${params.toString()}`);
      } catch {
        // Sandboxed embeds refuse history writes; the spinner works without the deep link.
      }
    });
    return () => cancelAnimationFrame(request);
  }, [frameIndex, enabled]);
}
