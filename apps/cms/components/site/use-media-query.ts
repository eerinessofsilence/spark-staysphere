'use client';

import * as React from 'react';

/** Below Tailwind's `sm`: where a card floating on a stage gives way to the product's sheet. */
export const PHONE_QUERY = '(max-width: 639px)';

/**
 * Whether `query` matches, kept current as the viewport changes. `false` on
 * the server and on the first client render, so read it for things that only
 * happen after a guest interacts — opening a sheet instead of a card, say —
 * never for markup that has to match the server's.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const list = window.matchMedia(query);
    const apply = () => setMatches(list.matches);
    apply();
    list.addEventListener('change', apply);
    return () => list.removeEventListener('change', apply);
  }, [query]);

  return matches;
}
