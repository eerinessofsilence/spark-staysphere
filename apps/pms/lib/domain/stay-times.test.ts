import { describe, expect, it } from 'vitest';
import { dayProgress, isEarlyCheckIn, isLateCheckOut, STANDARD_CHECK_IN_TIME, STANDARD_CHECK_OUT_TIME } from './stay-times';

describe('stay times', () => {
  it('positions noon at the centre of a calendar day', () => {
    expect(dayProgress('12:00')).toBe(0.5);
  });

  it('uses the actual minute for partial-day tape boundaries', () => {
    expect(dayProgress('18:00')).toBe(0.75);
    expect(dayProgress('11:30')).toBeCloseTo(47.9167 / 100, 4);
  });

  it('identifies only departures after the standard checkout as late', () => {
    expect(isLateCheckOut(STANDARD_CHECK_OUT_TIME)).toBe(false);
    expect(isLateCheckOut('18:00')).toBe(true);
  });

  it('identifies only arrivals before the standard check-in as early', () => {
    expect(isEarlyCheckIn(STANDARD_CHECK_IN_TIME)).toBe(false);
    expect(isEarlyCheckIn('08:00')).toBe(true);
  });
});
