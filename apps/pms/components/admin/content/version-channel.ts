'use client';

import * as React from 'react';

/**
 * One entity's version, shared between the controls on a page that write it.
 *
 * A room's form and its "Hide from the site" button both write the same overlay row, and each
 * carries the version it last saw. When one of them saves it announces the step it made
 * (`from` → `to`), and any other control still holding `from` steps forward with it. A control
 * holding anything else ignores the announcement: someone outside this page saved in between,
 * and that is a real conflict its next save should report — not one to paper over.
 */
interface VersionStep {
  key: string;
  from: number;
  to: number;
}

const listeners = new Set<(step: VersionStep) => void>();

export function announceVersion(key: string | undefined, from: number, to: number): void {
  if (!key || from === to) return;
  for (const listener of listeners) listener({ key, from, to });
}

export function useSharedVersion(
  key: string | undefined,
  initial: number,
): [number, React.Dispatch<React.SetStateAction<number>>] {
  const [version, setVersion] = React.useState(initial);

  React.useEffect(() => {
    if (!key) return;
    const listener = (step: VersionStep) => {
      if (step.key === key) setVersion((current) => (current === step.from ? step.to : current));
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [key]);

  return [version, setVersion];
}
