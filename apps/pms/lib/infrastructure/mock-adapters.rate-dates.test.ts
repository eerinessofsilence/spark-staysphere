import { describe, expect, it } from 'vitest';
import { createBookingEngineAdapter } from './mock-adapters';
import { mockHotelRepository } from './mock-hotel-repository';
import type { RatePlan } from '../domain/schemas';

describe('booking quote with dated room rates', () => {
  it('quotes the exact stay nights and leaves checkout uncharged', async () => {
    const plan: RatePlan = {
      id: 'rate-dated', roomTypeId: 'room-dated', name: 'Flexible', nightlyPrice: 200,
      nightlyPriceOverrides: { '2026-12-24': 280, '2026-12-26': 900 },
      currency: 'EUR', breakfastIncluded: false, includedServices: [], cancellationPolicy: 'Flexible',
    };
    const repository = {
      ...mockHotelRepository,
      listRatePlans: async () => [plan],
      getAvailability: async () => [
        { roomTypeId: plan.roomTypeId, date: '2026-12-23', remaining: 2, status: 'available' as const },
        { roomTypeId: plan.roomTypeId, date: '2026-12-24', remaining: 2, status: 'available' as const },
        { roomTypeId: plan.roomTypeId, date: '2026-12-25', remaining: 2, status: 'available' as const },
      ],
    };
    const quote = await createBookingEngineAdapter(repository).quote({
      roomTypeId: plan.roomTypeId, ratePlanId: plan.id,
      checkIn: '2026-12-23', checkOut: '2026-12-26', adults: 2, children: 0, addOnIds: [],
    });
    expect(quote.price.roomTotal).toBe(680);
    expect(quote.price.nightlyPrices).toEqual([200, 280, 200]);
    expect(quote.price.total).toBe(695);
  });

  it('does not substitute another plan when the requested plan is closed', async () => {
    const closed: RatePlan = {
      id: 'closed', roomTypeId: 'room-dated', name: 'Closed', nightlyPrice: 100,
      currency: 'EUR', breakfastIncluded: false, includedServices: [], cancellationPolicy: 'Flexible',
      closedDates: ['2026-12-24'],
    };
    const open = { ...closed, id: 'open', name: 'Open', closedDates: undefined };
    const repository = {
      ...mockHotelRepository,
      listRatePlans: async () => [closed, open],
      getAvailability: async () => [
        { roomTypeId: closed.roomTypeId, date: '2026-12-24', remaining: 2, status: 'available' as const },
      ],
    };
    const engine = createBookingEngineAdapter(repository);
    const input = { roomTypeId: closed.roomTypeId, checkIn: '2026-12-24', checkOut: '2026-12-25', adults: 2, children: 0, addOnIds: [] };
    expect((await engine.quote({ ...input, ratePlanId: closed.id })).available).toBe(false);
    expect((await engine.quote({ ...input, ratePlanId: open.id })).available).toBe(true);
    expect((await engine.quote({ ...input, ratePlanId: 'missing' })).available).toBe(false);
    expect((await engine.quote(input)).ratePlanId).toBe(open.id);
  });
});
