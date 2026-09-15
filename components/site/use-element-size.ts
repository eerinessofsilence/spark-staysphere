'use client';

import * as React from 'react';
import type { Size } from '@/components/site/cover-fit';

/**
 * The element's content box, kept current with a `ResizeObserver`. `0×0` until
 * the first measurement — callers that project onto the element treat that as
 * "not measured yet" and fall back to percentages.
 */
export function useElementSize(ref: React.RefObject<HTMLElement | null>): Size {
  const [size, setSize] = React.useState<Size>({ width: 0, height: 0 });

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
