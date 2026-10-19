'use client';

import * as React from 'react';

/**
 * Keeps `?frame=N` in the address bar in step with the orbit, so the view a
 * guest shares or reloads opens where they left it (`app/page.tsx` reads it
 * back). Written at most once per animation frame, with `replaceState` — a
 * drag must neither flood the history nor re-render the route.
 */
export function useFrameUrlSync(frameIndex: number, enabled: boolean) {
  const latestRef = React.useRef(frameIndex);
  latestRef.current = frameIndex;
  const pendingRef = React.useRef(false);

  React.useEffect(() => {
    if (!enabled || pendingRef.current) return;
    pendingRef.current = true;
    requestAnimationFrame(() => {
      pendingRef.current = false;
      const params = new URLSearchParams(window.location.search);
      params.set('frame', String(latestRef.current));
      try {
        window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
      } catch {
        // Sandboxed embeds refuse history writes; the spinner works without the deep link.
      }
    });
  }, [frameIndex, enabled]);
}
