import { describe, expect, it } from 'vitest';
import type { StayState } from './schemas';
import { STAY_TRANSITIONS, canTransitionStay } from './stay-state';

describe('canTransitionStay', () => {
  it('walks a stay forward: booked → checked in → checked out', () => {
    expect(canTransitionStay('booked', 'checked_in')).toBe(true);
    expect(canTransitionStay('checked_in', 'checked_out')).toBe(true);
  });

  it('marks a no-show only from booked, and lets it be taken back', () => {
    expect(canTransitionStay('booked', 'no_show')).toBe(true);
    expect(canTransitionStay('checked_in', 'no_show')).toBe(false);
    expect(canTransitionStay('no_show', 'booked')).toBe(true);
  });

  it('undoes exactly one step', () => {
    expect(canTransitionStay('checked_in', 'booked')).toBe(true);
    expect(canTransitionStay('checked_out', 'checked_in')).toBe(true);
    expect(canTransitionStay('checked_out', 'booked')).toBe(false);
  });

  it('never skips check-in', () => {
    expect(canTransitionStay('booked', 'checked_out')).toBe(false);
  });

  it('never offers the state a stay is already in', () => {
    for (const state of Object.keys(STAY_TRANSITIONS) as StayState[]) {
      expect(canTransitionStay(state, state)).toBe(false);
    }
  });
});
