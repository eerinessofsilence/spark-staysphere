import type { Clock } from './ports';

/**
 * The real clock. Pure and dependency-free (no I/O, no SDK), so unlike an
 * integration adapter it lives directly in `lib/domain` rather than
 * `lib/infrastructure` — there is nothing here `container.ts` needs to
 * choose between at runtime, only a fixed clock a test can substitute.
 */
export const systemClock: Clock = {
  now: () => new Date(),
};
