'use client';

import { ThinkingOrb, type OrbState } from 'thinking-orbs';
import { cn } from '@/lib/utils';

export type AssistantPhase =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'results'
  | 'empty'
  | 'error'
  | 'mic-denied';

/** Only these three get the product's one motion exception — see below. */
const ANIMATED_STATE: Partial<Record<AssistantPhase, OrbState>> = {
  listening: 'listening',
  transcribing: 'composing',
  thinking: 'searching',
};

/** Every other phase's own mark: a distinct dotted shape, frozen rather than caught mid-motion. */
const REST_STATE: OrbState = 'composing';

interface ThinkingOrbsProps {
  phase: AssistantPhase;
  /**
   * `thinking-orbs`'s `listening` animation is not amplitude-driven, so this
   * is accepted (existing call sites pass it) but no longer read.
   */
  getAmplitude?: () => number;
  className?: string;
}

/**
 * The product's only channel for machine state (listening/thinking) — see
 * the scoped Motion exception recorded in `DESIGN_SYSTEM.md`. Backed by the
 * `thinking-orbs` package rather than a hand-rolled one: canvas-drawn,
 * theme-aware, and it already renders a single static frame under
 * `prefers-reduced-motion` on its own, which is exactly what that exception
 * requires — nothing extra needed here for it.
 */
export function ThinkingOrbs({ phase, className }: ThinkingOrbsProps) {
  const state = ANIMATED_STATE[phase] ?? REST_STATE;
  const paused = !(phase in ANIMATED_STATE);

  return (
    <div className={cn('flex size-full items-center justify-center', className)} aria-hidden="true">
      {/* `auto` was resolving to dark ink on these light surfaces (glass, and
          `bg-stone` in its light-mode value), rendering pale-on-pale. Pinned
          to `light` for now, matching the light-only surfaces this product
          currently ships; revisit if a dark-mode variant of this chip shows up. */}
      <ThinkingOrb state={state} paused={paused} size={64} theme="light" />
    </div>
  );
}
