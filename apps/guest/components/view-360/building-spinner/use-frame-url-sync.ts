'use client';

import * as React from 'react';

/**
 * Persists the settled frame for sharing/reloading. The caller disables this
 * while turning: the router intercepts replaceState, so writing every frame
 * would notify navigation subscribers on the animation's hot path.
 */
export function useFrameUrlSync(frameIndex: number, enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return;
    const pathname = window.location.pathname;
    const request = requestAnimationFrame(() => {
      if (window.location.pathname !== pathname) return;
      const params = new URLSearchParams(window.location.search);
      if (params.get('frame') === String(frameIndex)) return;
      params.set('frame', String(frameIndex));
      try {
        window.history.replaceState(window.history.state, '', `${pathname}?${params.toString()}${window.location.hash}`);
      } catch {
        // Sandboxed embeds refuse history writes; the spinner works without the deep link.
      }
    });
    return () => cancelAnimationFrame(request);
  }, [frameIndex, enabled]);
}
