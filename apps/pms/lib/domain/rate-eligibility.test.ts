import { describe, expect, it } from 'vitest';
import type { RatePlan } from './schemas';
import { rateAllowsStay } from './rate-eligibility';

const rate: RatePlan = {
  id: 'rate-example', roomTypeId: 'room-example', name: 'Example', nightlyPrice: 100,
  currency: 'EUR', breakfastIncluded: false, includedServices: [], cancellationPolicy: 'Flexible',
};

describe('rateAllowsStay', () => {
  it('keeps existing rates unrestricted', () => {
    expect(rateAllowsStay(rate, '2026-10-05', 1)).toBe(true);
    expect(rateAllowsStay(rate, '2026-10-05', 60)).toBe(true);
  });

  it('applies the stricter minimum and the maximum', () => {
    const restricted = { ...rate, minimumStay: 2, minimumStayOnArrival: 3, maximumStay: 5 };
    expect(rateAllowsStay(restricted, '2026-10-05', 2)).toBe(false);
    expect(rateAllowsStay(restricted, '2026-10-05', 3)).toBe(true);
    expect(rateAllowsStay(restricted, '2026-10-05', 6)).toBe(false);
  });

  it('checks every night but not the checkout date', () => {
    const restricted = { ...rate, closedDates: ['2026-10-07'] };
    expect(rateAllowsStay(restricted, '2026-10-05', 2)).toBe(true);
    expect(rateAllowsStay(restricted, '2026-10-05', 3)).toBe(false);
  });
});
