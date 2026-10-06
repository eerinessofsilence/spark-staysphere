import { describe, expect, it } from 'vitest';
import type { Booking } from '@/lib/domain/schemas';
import { demoHotel, demoRates, demoRooms } from '@/lib/infrastructure/mock-data';
import { buildRateRecommendations, todayRateIncrease, type RateRoomInput } from './rate-recommendations';

const room = demoRooms[0]!;
const rate = demoRates.find((item) => item.roomTypeId === room.id)!;
const row: RateRoomInput = { room, rates: [rate], capacity: 10, override: null };

function booking(date: string, index: number): Booking {
  return {
    id: `booking-${date}-${index}`, reference: `REF${index}`, idempotencyKey: `key-${date}-${index}`,
    hotelId: demoHotel.id, roomTypeId: room.id, ratePlanId: rate.id,
    checkIn: date, checkOut: new Date(Date.parse(`${date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10),
    adults: 2, children: 0,
    guest: { firstName: 'Test', lastName: 'Guest', email: `guest${index}@example.com`, phone: '12345678' },
    addOnIds: [], total: rate.nightlyPrice, currency: rate.currency, status: 'confirmed',
    stayState: 'booked', createdAt: `${date}T00:00:00.000Z`,
  };
}

describe('buildRateRecommendations', () => {
  it('suggests a review for a nearby holiday only when confirmed bookings show pressure', () => {
    const date = '2026-10-06';
    const result = buildRateRecommendations({
      today: '2026-10-04', currency: 'EUR', holidays: [{ date, name: 'Local holiday' }],
      rooms: [row], bookings: Array.from({ length: 8 }, (_, index) => booking(date, index)),
    });
    expect(result).toMatchObject({ status: 'ready', recommendations: [{
      event: 'holiday', direction: 'increase', date, booked: 8, capacity: 10,
      currentPrice: rate.nightlyPrice, href: `/admin/rates/${room.id}?from=${date}&days=7`,
    }] });
  });

  it('does not turn a distant holiday or weekend with no pressure into a permanent alert', () => {
    const result = buildRateRecommendations({
      today: '2026-10-04', currency: 'EUR', holidays: [{ date: '2026-10-28', name: 'Ohi Day' }],
      rooms: [row], bookings: [],
    });
    expect(result).toEqual({ status: 'ready', currency: 'EUR', recommendations: [] });
  });

  it('can suggest lowering a last-minute weekend rate when booking pace is weak', () => {
    const history = ['2026-10-03', '2026-09-26', '2026-09-19', '2026-09-12']
      .flatMap((date) => Array.from({ length: 5 }, (_, index) => booking(date, index)));
    const result = buildRateRecommendations({
      today: '2026-10-08', currency: 'EUR', holidays: [], rooms: [row], bookings: history,
    });
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.recommendations).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: '2026-10-10', event: 'weekend', direction: 'decrease', changePercent: -8, booked: 0 }),
    ]));
  });

  it('uses the configured price on that night and ignores hidden or manually closed rooms', () => {
    const date = '2026-10-10';
    const bookings = Array.from({ length: 8 }, (_, index) => booking(date, index));
    const price = rate.nightlyPrice + 40;
    const input = { today: '2026-10-08', currency: 'EUR' as const, holidays: [], bookings };
    const result = buildRateRecommendations({ ...input, rooms: [{ ...row, rates: [{ ...rate, nightlyPriceOverrides: { [date]: price } }] }] });
    expect(result.status === 'ready' ? result.recommendations[0]?.currentPrice : null).toBe(price);
    expect(buildRateRecommendations({ ...input, rooms: [{ ...row, override: 'sold_out' }] })).toMatchObject({ recommendations: [] });
    expect(buildRateRecommendations({ ...input, rooms: [{ ...row, room: { ...room, hidden: true } }] })).toMatchObject({ recommendations: [] });
  });

  it('suppresses a weak-weekend discount when equally weak prior Saturdays are the norm', () => {
    const result = buildRateRecommendations({
      today: '2026-10-08', currency: 'EUR', holidays: [], rooms: [row], bookings: [],
    });
    expect(result.status === 'ready' ? result.recommendations.find((item) => item.date === '2026-10-10') : null).toBeUndefined();
  });

  it('includes every matching holiday date and merges names on the same day', () => {
    const dates = ['2026-10-06', '2026-10-07'];
    const result = buildRateRecommendations({
      today: '2026-10-04', currency: 'EUR',
      holidays: [
        { date: dates[0]!, name: 'Festival A' },
        { date: dates[0]!, name: 'Festival B' },
        { date: dates[1]!, name: 'Festival C' },
      ],
      rooms: [row], bookings: dates.flatMap((date) => Array.from({ length: 8 }, (_, index) => booking(date, index))),
    });
    expect(result.status === 'ready' ? result.recommendations.map((item) => [item.date, item.holidayName]) : null)
      .toEqual([['2026-10-06', 'Festival A, Festival B'], ['2026-10-07', 'Festival C']]);
  });

  it('uses the hotel country weekend rather than assuming Friday and Saturday', () => {
    const date = '2026-10-09';
    const result = buildRateRecommendations({
      today: '2026-10-08', currency: 'EUR', holidays: [], weekendDays: [5, 6],
      rooms: [row], bookings: Array.from({ length: 8 }, (_, index) => booking(date, index)),
    });
    expect(result.status === 'ready' ? result.recommendations[0]?.date : null).toBe(date);
  });

  it('reserves the toast for an increase on the hotel’s current day', () => {
    const today = '2026-10-10';
    const bookings = Array.from({ length: 8 }, (_, index) => booking(today, index));
    const result = buildRateRecommendations({ today, currency: 'EUR', holidays: [], rooms: [row], bookings });
    expect(todayRateIncrease(result)).toMatchObject({ date: today, direction: 'increase', event: 'weekend' });
    const future = buildRateRecommendations({ today: '2026-10-09', currency: 'EUR', holidays: [], rooms: [row], bookings });
    expect(todayRateIncrease(future)).toBeNull();
  });

  it('reviews weekdays in the grid window and shows a percentage without changing rates', () => {
    const date = '2026-10-07';
    const result = buildRateRecommendations({
      today: '2026-10-05', from: date, days: 1, includeWeekdays: true,
      currency: 'EUR', holidays: [], rooms: [row],
      bookings: Array.from({ length: 9 }, (_, index) => booking(date, index)),
    });
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.recommendations).toMatchObject([{
      date, event: 'weekday', direction: 'increase', changePercent: 10,
      suggestedPrice: Math.round(rate.nightlyPrice * 1.1 * 100) / 100,
    }]);
    expect(rate.nightlyPriceOverrides?.[date]).toBeUndefined();
  });

  it('does not suggest discounting an ordinary weekday without a baseline or a closed rate', () => {
    const date = '2026-10-07';
    const input = {
      today: '2026-10-05', from: date, days: 1, includeWeekdays: true,
      currency: 'EUR' as const, holidays: [], bookings: [], rooms: [row],
    };
    expect(buildRateRecommendations(input)).toMatchObject({ recommendations: [] });
    const bookings = Array.from({ length: 8 }, (_, index) => booking(date, index));
    expect(buildRateRecommendations({ ...input, bookings, rooms: [{ ...row, rates: [{ ...rate, closedDates: [date] }] }] }))
      .toMatchObject({ recommendations: [] });
  });
});
