'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { AssistantLauncherVisual } from './assistant-launcher-visual';

export type AssistantPhase =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'results'
  | 'empty'
  | 'error'
  | 'mic-denied';

interface ThinkingOrbsProps {
  phase: AssistantPhase;
  hidden?: boolean;
  className?: string;
}

/**
 * The same mesh as the launcher, animated only during the panel's active
 * listening/thinking states. The status region carries the phase in words.
 */
export function ThinkingOrbs({ phase, hidden = false, className }: ThinkingOrbsProps) {
  const [documentHidden, setDocumentHidden] = React.useState(false);
  const animated = phase === 'listening' || phase === 'transcribing' || phase === 'thinking';

  React.useEffect(() => {
    const updateVisibility = () => setDocumentHidden(document.hidden);
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  return (
    <div className={cn('relative size-full rounded-full', className)} aria-hidden="true">
      <AssistantLauncherVisual
        id="guest-assistant-panel-orb"
        hidden={hidden || documentHidden || !animated}
      />
    </div>
  );
}
