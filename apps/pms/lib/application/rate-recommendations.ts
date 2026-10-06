import { addIsoDays } from '@/lib/domain/dates';
import type { Booking, Currency, RatePlan, RoomStatus, RoomType } from '@/lib/domain/schemas';

export type RateRecommendation = {
  id: string;
  date: string;
  event: 'holiday' | 'weekend' | 'weekday';
  holidayName?: string;
  direction: 'increase' | 'decrease';
  roomTypeId: string;
  roomName: string;
  rateName: string;
  currentPrice: number;
  suggestedPrice: number;
  changePercent: number;
  booked: number;
  capacity: number;
  baselinePercent: number | null;
  daysAway: number;
  href: string;
};

export type RateRecommendationResult = {
  status: 'ready';
  currency: Currency;
  recommendations: RateRecommendation[];
} | { status: 'unavailable' };

/** Only a same-day, evidence-backed increase warrants an interruptive toast. */
export function todayRateIncrease(result: RateRecommendationResult): RateRecommendation | null {
  return result.status === 'ready'
    ? result.recommendations.find((item) => item.daysAway === 0 && item.direction === 'increase') ?? null
    : null;
}

export type RateRoomInput = {
  room: RoomType;
  rates: RatePlan[];
  capacity: number;
  override: RoomStatus | null;
};

function confirmedNights(bookings: Booking[], roomTypeId: string, date: string): number {
  return bookings.filter((booking) => booking.status === 'confirmed' && booking.roomTypeId === roomTypeId &&
    booking.checkIn <= date && date < booking.checkOut).length;
}

/** A small, explainable review signal, never an automatic or ML price change. */
export function buildRateRecommendations(input: {
  today: string;
  /** Optional grid window; the assistant still reviews the next seven nights. */
  from?: string;
  days?: number;
  includeWeekdays?: boolean;
  limit?: number;
  currency: Currency;
  holidays: Array<{ date: string; name: string }>;
  /** ISO weekdays from the hotel's locale, Monday=1 through Sunday=7. */
  weekendDays?: number[];
  rooms: RateRoomInput[];
  bookings: Booking[];
}): RateRecommendationResult {
  const { today, currency, holidays, rooms, bookings, weekendDays = [6, 7],
    from = today, days = 7, includeWeekdays = false, limit = 5 } = input;
  const recommendations: RateRecommendation[] = [];
  const holidayNames = new Map<string, string[]>();
  for (const holiday of holidays) holidayNames.set(holiday.date, [...(holidayNames.get(holiday.date) ?? []), holiday.name]);

  for (let offset = 0; offset < Math.min(days, 90); offset++) {
    const date = addIsoDays(from, offset);
    if (date < today) continue;
    const daysAway = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
    const isHoliday = holidayNames.has(date);
    const isWeekend = weekendDays.includes(weekday);
    if (!includeWeekdays && !isHoliday && !isWeekend) continue;
    const event = isHoliday ? 'holiday' : isWeekend ? 'weekend' : 'weekday';

    for (const { room, rates, capacity, override } of rooms) {
      if (room.hidden || override !== null || capacity < 2 || rates.length === 0) continue;
      const booked = Math.min(capacity, confirmedNights(bookings, room.id, date));
      const occupancy = booked / capacity;
      const prior = [1, 2, 3, 4].map((week) => addIsoDays(date, -7 * week)).filter((day) => day < today);
      const baselinePercent = prior.length >= 2
        ? Math.round(prior.reduce((sum, day) => sum + Math.min(capacity, confirmedNights(bookings, room.id, day)) / capacity, 0) / prior.length * 100)
        : null;

      // A date alone is not evidence of demand. Only confirmed booking pressure
      // supports an increase; a late, lightly booked event can prompt a review
      // for a reduction. Full inventory has nothing left to reprice.
      const direction = occupancy >= 0.7 && booked < capacity && (baselinePercent === null || occupancy * 100 >= baselinePercent - 10) ? 'increase'
        : daysAway <= 3 && occupancy <= 0.25 && (baselinePercent !== null ? baselinePercent >= 40 : event !== 'weekday') ? 'decrease' : null;
      if (!direction) continue;
      const rate = rates.filter((item) => !item.closedDates?.includes(date) && (item.nightlyPriceOverrides?.[date] ?? item.nightlyPrice) > 0)
        .sort((a, b) => (a.nightlyPriceOverrides?.[date] ?? a.nightlyPrice) - (b.nightlyPriceOverrides?.[date] ?? b.nightlyPrice))[0];
      if (!rate) continue;
      const currentPrice = rate.nightlyPriceOverrides?.[date] ?? rate.nightlyPrice;
      // Conservative percentage bands are review examples, not a forecast.
      const changePercent = direction === 'increase'
        ? (occupancy >= 0.9 ? 10 : occupancy >= 0.8 ? 8 : 5)
        : (occupancy === 0 && daysAway <= 1 ? -10 : occupancy <= 0.1 ? -8 : -5);
      const suggestedPrice = Math.round(currentPrice * (1 + changePercent / 100) * 100) / 100;
      recommendations.push({
        id: `${date}:${room.id}:${rate.id}:${direction}`,
        date, event, ...(isHoliday ? { holidayName: holidayNames.get(date)!.join(', ') } : {}), direction,
        roomTypeId: room.id, roomName: room.name, rateName: rate.name,
        currentPrice, suggestedPrice, changePercent, booked, capacity, baselinePercent, daysAway,
        href: `/admin/rates/${encodeURIComponent(room.id)}?from=${date}&days=7`,
      });
    }
  }

  recommendations.sort((a, b) => a.daysAway - b.daysAway || Number(b.event === 'holiday') - Number(a.event === 'holiday') ||
    (b.booked / b.capacity) - (a.booked / a.capacity));
  return { status: 'ready', currency, recommendations: recommendations.slice(0, limit) };
}
