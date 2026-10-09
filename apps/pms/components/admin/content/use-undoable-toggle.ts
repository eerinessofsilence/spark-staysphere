'use client';

import * as React from 'react';

/**
 * The pending/message/undo-offer state shared by every "act at once, offer
 * an undo for a few seconds" admin switch — RoomVisibilityToggle,
 * AddOnSaleToggle, AddOnToggle. Each one still writes its own apply/change
 * handler: whether it refreshes on a failed save and whether it shows a
 * message on success differ deliberately between a quiet list row and a
 * page's own switch, so only the state itself is shared here, not the
 * decision logic around it.
 */
export function useUndoableToggle<T>() {
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [undoTo, setUndoTo] = React.useState<T | null>(null);

  React.useEffect(() => {
    if (undoTo === null) return;
    const timer = window.setTimeout(() => setUndoTo(null), 12_000);
    return () => window.clearTimeout(timer);
  }, [undoTo]);

  return { pending, setPending, message, setMessage, undoTo, setUndoTo } as const;
}
