import { describe, expect, it } from 'vitest';
import { addIsoDays } from './dates';

describe('addIsoDays', () => {
  it('adds days within a month', () => {
    expect(addIsoDays('2026-10-01', 3)).toBe('2026-10-04');
  });

  it('rolls over a month boundary', () => {
    expect(addIsoDays('2026-10-30', 3)).toBe('2026-11-02');
  });

  it('subtracts with a negative count', () => {
    expect(addIsoDays('2026-10-01', -1)).toBe('2026-09-30');
  });

  it('is a no-op for zero days', () => {
    expect(addIsoDays('2026-10-01', 0)).toBe('2026-10-01');
  });
});
