import { describe, expect, it } from 'vitest';
import { demoRates, demoRooms } from '@/lib/infrastructure/mock-data';
import { holidayRateSuggestions, holidayRoomSignals, type HolidayRoomInput } from './holiday-rate-insight';

const room = demoRooms[0]!;
const rate = demoRates.find((item) => item.roomTypeId === room.id)!;
const base: HolidayRoomInput = { room, rates: [rate], capacity: 10, remaining: 2, override: null, confirmedBookings: 3 };

describe('holidayRoomSignals', () => {
  it('flags a sellable room type with scarce inventory and shows the current base price', () => {
    expect(holidayRoomSignals([base])[0]).toMatchObject({ unavailable: 8, pressurePercent: 80, reviewIncrease: true, lowestBasePrice: rate.nightlyPrice });
  });

  it('does not recommend an increase for a manually closed or hidden room type', () => {
    expect(holidayRoomSignals([{ ...base, override: 'sold_out', remaining: 0 }])[0]?.reviewIncrease).toBe(false);
    expect(holidayRoomSignals([{ ...base, room: { ...room, hidden: true } }])[0]?.reviewIncrease).toBe(false);
  });

  it('does not manufacture pressure when capacity or availability is missing', () => {
    expect(holidayRoomSignals([{ ...base, capacity: 0, remaining: null }])[0]).toMatchObject({ pressurePercent: 0, reviewIncrease: false });
    expect(holidayRoomSignals([{ ...base, remaining: null }])[0]).toMatchObject({ pressurePercent: 0, reviewIncrease: false });
  });

  it('exposes only actionable room-specific suggestions to the assistant', () => {
    const signals = holidayRoomSignals([
      base,
      { ...base, room: { ...room, id: 'closed-room', name: 'Closed room' }, override: 'sold_out', remaining: 0 },
      { ...base, room: { ...room, id: 'available-room', name: 'Available room' }, remaining: 8 },
    ]);
    expect(holidayRateSuggestions(signals)).toEqual([{
      roomTypeId: room.id,
      roomName: room.name,
      capacity: 10,
      remaining: 2,
      basePrice: rate.nightlyPrice,
    }]);
  });
});
