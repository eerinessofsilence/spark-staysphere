import { describe, expect, it } from 'vitest';
import type { AddOn, RatePlan } from './schemas';
import {
  addOnQuantity,
  buildPriceBreakdown,
  CITY_TAX_PER_ADULT_PER_NIGHT,
  nightsBetween,
  roundMoney,
  withoutOrphanedExtras,
} from './pricing';

function ratePlan(overrides: Partial<RatePlan> = {}): RatePlan {
  return {
    id: 'rate_sea-flex',
    roomTypeId: 'room_deluxe-sea',
    name: 'Flexible',
    nightlyPrice: 220,
    currency: 'EUR',
    breakfastIncluded: true,
    includedServices: [],
    cancellationPolicy: 'Free cancellation up to 48h before arrival.',
    ...overrides,
  };
}

function addOn(overrides: Partial<AddOn> = {}): AddOn {
  return {
    id: 'addon_sunset-kayak-tour',
    name: 'Sunset kayak tour',
    description: '',
    category: 'service',
    price: 45,
    currency: 'EUR',
    pricingUnit: 'per_guest',
    enabled: true,
    ...overrides,
  };
}

describe('roundMoney', () => {
  it('rounds to the nearest cent', () => {
    expect(roundMoney(129.995)).toBe(130);
    expect(roundMoney(10.004)).toBe(10);
  });

  it('does not carry floating-point noise into the result', () => {
    // 0.1 + 0.2 famously isn't 0.3 in IEEE 754; the money path must never
    // leak that into a displayed total.
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });
});

describe('nightsBetween', () => {
  it('counts calendar days between check-in and check-out', () => {
    expect(nightsBetween('2026-10-01', '2026-10-04')).toBe(3);
  });

  it('floors at one night for a same-day range', () => {
    expect(nightsBetween('2026-10-01', '2026-10-01')).toBe(1);
  });

  it('floors at one night when check-out precedes check-in', () => {
    expect(nightsBetween('2026-10-05', '2026-10-01')).toBe(1);
  });
});

describe('addOnQuantity', () => {
  it('charges a per_night extra once per night', () => {
    expect(addOnQuantity(addOn({ pricingUnit: 'per_night' }), 4, 2)).toBe(4);
  });

  it('charges a per_guest extra once per guest', () => {
    expect(addOnQuantity(addOn({ pricingUnit: 'per_guest' }), 4, 3)).toBe(3);
  });

  it('floors a per_guest extra at one guest, never zero', () => {
    expect(addOnQuantity(addOn({ pricingUnit: 'per_guest' }), 4, 0)).toBe(1);
  });

  it('charges a per_stay extra exactly once', () => {
    expect(addOnQuantity(addOn({ pricingUnit: 'per_stay' }), 7, 4)).toBe(1);
  });
});

describe('withoutOrphanedExtras', () => {
  it('keeps an extra with no parent', () => {
    const dinner = addOn({ id: 'addon_dinner' });
    expect(withoutOrphanedExtras([dinner])).toEqual([dinner]);
  });

  it('keeps an extra whose parent is present', () => {
    const dinner = addOn({ id: 'addon_dinner' });
    const wine = addOn({ id: 'addon_wine-pairing', parentId: 'addon_dinner' });
    expect(withoutOrphanedExtras([dinner, wine])).toEqual([dinner, wine]);
  });

  it('drops an extra whose parent was not selected', () => {
    const wine = addOn({ id: 'addon_wine-pairing', parentId: 'addon_dinner' });
    expect(withoutOrphanedExtras([wine])).toEqual([]);
  });
});

describe('buildPriceBreakdown', () => {
  it('prices a plain stay with no extras: room total plus city tax on adults only', () => {
    const breakdown = buildPriceBreakdown({
      ratePlan: ratePlan({ nightlyPrice: 220 }),
      addOns: [],
      nights: 3,
      adults: 2,
      children: 1,
    });

    expect(breakdown.roomTotal).toBe(660); // 220 * 3
    expect(breakdown.taxesAndFees).toBe(roundMoney(CITY_TAX_PER_ADULT_PER_NIGHT * 2 * 3)); // adults only
    expect(breakdown.addOnsTotal).toBe(0);
    expect(breakdown.total).toBe(breakdown.roomTotal + breakdown.taxesAndFees);
    expect(breakdown.otaComparisonTotal).toBeNull();
    expect(breakdown.directSaving).toBe(0);
  });

  it('excludes a disabled add-on from the total', () => {
    const breakdown = buildPriceBreakdown({
      ratePlan: ratePlan(),
      addOns: [addOn({ enabled: false, price: 45 })],
      nights: 2,
      adults: 2,
      children: 0,
    });

    expect(breakdown.addOnLines).toEqual([]);
    expect(breakdown.addOnsTotal).toBe(0);
  });

  it('drops an extra whose parent was not chosen, even if the extra itself is enabled', () => {
    const wine = addOn({ id: 'addon_wine-pairing', parentId: 'addon_dinner', price: 30, enabled: true });
    const breakdown = buildPriceBreakdown({
      ratePlan: ratePlan(),
      addOns: [wine],
      nights: 2,
      adults: 2,
      children: 0,
    });

    expect(breakdown.addOnLines).toEqual([]);
  });

  it('prices per_night, per_guest and per_stay extras correctly and sums them', () => {
    const nightly = addOn({ id: 'addon_parking', pricingUnit: 'per_night', price: 15 });
    const perGuest = addOn({ id: 'addon_kayak', pricingUnit: 'per_guest', price: 45 });
    const perStay = addOn({ id: 'addon_late-checkout', pricingUnit: 'per_stay', price: 25 });

    const breakdown = buildPriceBreakdown({
      ratePlan: ratePlan({ nightlyPrice: 200 }),
      addOns: [nightly, perGuest, perStay],
      nights: 3,
      adults: 2,
      children: 1, // 3 guests total
    });

    const nightlyLine = breakdown.addOnLines.find((line) => line.addOnId === 'addon_parking');
    const guestLine = breakdown.addOnLines.find((line) => line.addOnId === 'addon_kayak');
    const stayLine = breakdown.addOnLines.find((line) => line.addOnId === 'addon_late-checkout');

    expect(nightlyLine?.quantity).toBe(3);
    expect(nightlyLine?.total).toBe(45); // 15 * 3
    expect(guestLine?.quantity).toBe(3);
    expect(guestLine?.total).toBe(135); // 45 * 3
    expect(stayLine?.quantity).toBe(1);
    expect(stayLine?.total).toBe(25);

    expect(breakdown.addOnsTotal).toBe(45 + 135 + 25);
    expect(breakdown.total).toBe(breakdown.roomTotal + breakdown.addOnsTotal + breakdown.taxesAndFees);
  });

  it('orders each extra directly after its parent, in the order the parents appear', () => {
    const dinner = addOn({ id: 'addon_dinner', pricingUnit: 'per_guest' });
    const wine = addOn({ id: 'addon_wine-pairing', parentId: 'addon_dinner', pricingUnit: 'per_guest' });
    const transfer = addOn({ id: 'addon_transfer', pricingUnit: 'per_stay' });

    const breakdown = buildPriceBreakdown({
      ratePlan: ratePlan(),
      addOns: [dinner, wine, transfer],
      nights: 1,
      adults: 2,
      children: 0,
    });

    expect(breakdown.addOnLines.map((line) => line.addOnId)).toEqual([
      'addon_dinner',
      'addon_wine-pairing',
      'addon_transfer',
    ]);
  });

  it('computes the OTA comparison total and the direct saving from it', () => {
    const breakdown = buildPriceBreakdown({
      ratePlan: ratePlan({ nightlyPrice: 200, otaComparisonPrice: 260 }),
      addOns: [],
      nights: 2,
      adults: 2,
      children: 0,
    });

    // direct: 200*2 + tax; OTA: 260*2 + same tax.
    expect(breakdown.otaComparisonTotal).toBe(520 + breakdown.taxesAndFees);
    expect(breakdown.directSaving).toBe(120);
  });

  it('floors the direct saving at zero when the OTA price is not actually higher', () => {
    const breakdown = buildPriceBreakdown({
      ratePlan: ratePlan({ nightlyPrice: 200, otaComparisonPrice: 150 }),
      addOns: [],
      nights: 1,
      adults: 1,
      children: 0,
    });

    expect(breakdown.directSaving).toBe(0);
  });
});
