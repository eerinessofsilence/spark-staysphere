'use client';

import * as React from 'react';

/** How long every overlay in the product takes to arrive, and to leave. */
export const OVERLAY_TRANSITION_MS = 200;

/**
 * The open/close state an overlay needs to animate both ways.
 *
 * `rendered` stays true for one transition after `open` goes false, so the
 * close plays out instead of the panel vanishing on the frame it is dismissed
 * — the harshest moment in any of these, because dismissing is usually the
 * result of the guest having just chosen something.
 *
 * `visible` is false on the frame the panel mounts and true two frames later.
 * Two, not one: a single `requestAnimationFrame` still runs before the browser
 * has painted the panel in its starting state, so the class flip has nothing
 * to transition from and the panel simply appears. The second frame is the one
 * that has seen `opacity-0`.
 */
export function useOverlayTransition(open: boolean) {
  const [rendered, setRendered] = React.useState(open);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setRendered(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setVisible(false);
    const timeout = window.setTimeout(() => setRendered(false), OVERLAY_TRANSITION_MS);
    return () => window.clearTimeout(timeout);
  }, [open]);

  return { rendered, visible };
}
