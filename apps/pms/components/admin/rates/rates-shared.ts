import { addDays, parseISO } from 'date-fns';
import { buildQuery, toIsoDate } from '@/lib/application/search-params';

// Wide enough for `RatePriceForm`'s own row (two price inputs and a save
// button, unwrapped) to fit inside a sticky column this fixed-width without
// spilling into the first date column next to it.
export const RATES_LABEL_WIDTH = '20rem';
export const RATES_NIGHT_WIDTH = '4.5rem';

export function ratesHref({ from, days, q }: { from: string; days: number; q?: string }): string {
  const params = new URLSearchParams({ from, days: String(days) });
  if (q) params.set('q', q);
  return `/admin/rates?${params.toString()}`;
}

export function holidayRatesHref({ from, days }: { from: string; days: number }): string {
  const params = new URLSearchParams({ tab: 'holidays', from, days: String(days) });
  return `/admin/rates?${params.toString()}`;
}

export function roomRatesHref(roomId: string, { from, days }: { from: string; days: number }): string {
  return `/admin/rates/${roomId}?from=${from}&days=${days}`;
}

/** A one-night guest quote for the date whose public price just changed. */
export function ratePreviewHref(roomSlug: string, date: string, guestBaseUrl?: string): string {
  const criteria = {
    checkIn: date,
    checkOut: toIsoDate(addDays(parseISO(date), 1)),
    adults: 2,
    children: 0,
  };
  const path = `/rooms/${encodeURIComponent(roomSlug)}?${buildQuery({ criteria })}`;
  return guestBaseUrl ? new URL(path, guestBaseUrl).toString() : path;
}

/** The date window every rates screen shares: the nights shown, and the grid template both size to. */
export function buildDateWindow(from: string, days: number) {
  const dates = Array.from({ length: days }, (_, index) => toIsoDate(addDays(parseISO(from), index)));
  const windowEnd = toIsoDate(addDays(parseISO(from), days));
  const columns = `minmax(${RATES_LABEL_WIDTH}, ${RATES_LABEL_WIDTH}) repeat(${dates.length}, minmax(${RATES_NIGHT_WIDTH}, 1fr))`;
  const minWidth = `calc(${RATES_LABEL_WIDTH} + ${dates.length} * ${RATES_NIGHT_WIDTH})`;
  return { dates, windowEnd, columns, minWidth };
}
