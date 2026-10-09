import { describe, expect, it } from 'vitest';
import type { RatePlan } from '../domain/schemas';
import { demoHotel, demoRooms } from '../infrastructure/mock-data';
import { mockHotelRepository } from '../infrastructure/mock-hotel-repository';
import { createBookingEngineAdapter } from '../infrastructure/mock-adapters';
import { CatalogService, defaultRoomFilters } from './catalog-service';

describe('catalog rate restrictions', () => {
  it('offers an eligible plan and keeps a closed room visible as unavailable', async () => {
    const room = demoRooms.find((candidate) => candidate.hotelId === demoHotel.id && !candidate.hidden)!;
    const original = (await mockHotelRepository.listRatePlans(room.id))[0]!;
    const closed: RatePlan = { ...original, id: 'closed-plan', closedDates: ['2026-12-24'] };
    const open: RatePlan = { ...original, id: 'open-plan' };
    const criteria = { checkIn: '2026-12-24', checkOut: '2026-12-25', adults: 2, children: 0 };
    const makeCatalog = (plans: RatePlan[]) => {
      const repository = {
        ...mockHotelRepository,
        listRatePlans: async (id: string) => id === room.id ? plans : mockHotelRepository.listRatePlans(id),
        getAvailability: async (id: string, from: string) => [{ roomTypeId: id, date: from, remaining: 2, status: 'available' as const }],
      };
      return new CatalogService(repository, createBookingEngineAdapter(repository));
    };

    const withAlternative = await makeCatalog([closed, open]).search(demoHotel.slug, criteria, defaultRoomFilters);
    expect(withAlternative.offers.find((offer) => offer.room.id === room.id)?.ratePlan.id).toBe(open.id);

    const withoutAlternative = await makeCatalog([closed]).search(demoHotel.slug, criteria, defaultRoomFilters);
    expect(withoutAlternative.offers.find((offer) => offer.room.id === room.id)?.status).toBe('sold_out');
  });
});
