import type { Currency, RoomStatus, RoomType, RatePlan } from '@/lib/domain/schemas';
import type { HolidayRateAdvice, HolidayRateAdviceResult } from './holiday-rate-advisor';

export type HolidayRateSuggestion = {
  roomTypeId: string;
  roomName: string;
  capacity: number;
  remaining: number;
  basePrice: number;
};

export type HolidayRateReviewResult =
  | (HolidayRateAdvice & { currency: Currency; suggestions: HolidayRateSuggestion[] })
  | Exclude<HolidayRateAdviceResult, HolidayRateAdvice>;

export type HolidayRoomInput = {
  room: RoomType;
  rates: RatePlan[];
  capacity: number;
  remaining: number | null;
  override: RoomStatus | null;
  confirmedBookings: number;
};

export type HolidayRoomSignal = HolidayRoomInput & {
  unavailable: number;
  pressurePercent: number;
  reviewIncrease: boolean;
  lowestBasePrice: number | null;
};

/** Scarcity is a reason to review a rate, not an automatic price change. */
export function holidayRoomSignals(inputs: HolidayRoomInput[]): HolidayRoomSignal[] {
  return inputs.map((input) => {
    const remaining = input.remaining === null ? null : Math.max(0, Math.min(input.capacity, input.remaining));
    const unavailable = remaining === null ? 0 : input.capacity - remaining;
    const pressurePercent = input.capacity > 0 && remaining !== null
      ? Math.round((unavailable / input.capacity) * 100)
      : 0;
    return {
      ...input,
      unavailable,
      pressurePercent,
      lowestBasePrice: input.rates.length ? Math.min(...input.rates.map((rate) => rate.nightlyPrice)) : null,
      reviewIncrease: !input.room.hidden && input.override === null && input.capacity > 0 && remaining !== null &&
        input.rates.length > 0 && pressurePercent >= 70,
    };
  }).sort((a, b) => Number(b.reviewIncrease) - Number(a.reviewIncrease) || b.pressurePercent - a.pressurePercent);
}

/** Only actionable room types become proactive holiday suggestions. */
export function holidayRateSuggestions(signals: HolidayRoomSignal[]): HolidayRateSuggestion[] {
  return signals.flatMap((signal) => {
    if (!signal.reviewIncrease || signal.remaining === null || signal.lowestBasePrice === null) return [];
    return [{
      roomTypeId: signal.room.id,
      roomName: signal.room.name,
      capacity: signal.capacity,
      remaining: signal.remaining,
      basePrice: signal.lowestBasePrice,
    }];
  });
}
