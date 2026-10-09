import type { PublicHolidayPort } from '@/lib/domain/ports';
import type { Hotel } from '@/lib/domain/schemas';
import { addIsoDays } from '@/lib/domain/dates';

export type HolidayRateAdvice = {
  status: 'ready';
  date: string;
  holidayName: string;
  countryCode: string;
  countryName: string;
  daysAway: number;
  ratesHref: string;
};

export type HolidayRateAdviceResult = HolidayRateAdvice | { status: 'none' | 'unavailable' | 'unknown_country' };
export type HolidayRateAdviceListResult =
  | { status: 'ready'; holidays: HolidayRateAdvice[] }
  | { status: 'unavailable' | 'unknown_country' };

/** Resolve the country part of a hotel's saved location without assuming its city or time zone. */
export function hotelCountryCode(location: string): string | null {
  const country = location.split(',').at(-1)?.trim() ?? '';
  if (/^[A-Za-z]{2}$/.test(country)) return country.toUpperCase();
  const normalized = country.toLocaleLowerCase('en').replace(/[.]/g, '').trim();
  const aliases: Record<string, string> = {
    'united states': 'US', usa: 'US', 'united kingdom': 'GB', uk: 'GB',
    'south korea': 'KR', 'czech republic': 'CZ', 'the netherlands': 'NL',
  };
  if (aliases[normalized]) return aliases[normalized];
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  for (let first = 65; first <= 90; first++) {
    for (let second = 65; second <= 90; second++) {
      const code = String.fromCharCode(first, second);
      if (names.of(code)?.toLocaleLowerCase('en') === normalized) return code;
    }
  }
  return null;
}

/** CLDR weekend days for the hotel's country; Saturday/Sunday if unavailable. */
export function hotelWeekendDays(countryCode: string | null): number[] {
  if (!countryCode) return [6, 7];
  try {
    const locale = new Intl.Locale(`en-${countryCode}`) as Intl.Locale & { weekInfo?: { weekend: number[] } };
    return locale.weekInfo?.weekend ?? [6, 7];
  } catch {
    return [6, 7];
  }
}

export function hotelToday(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Holiday is a reason to review demand, not proof that a higher price will sell. */
export class HolidayRateAdvisor {
  constructor(private readonly calendar: PublicHolidayPort) {}

  async next(hotel: Hotel, now: Date): Promise<HolidayRateAdviceResult> {
    const today = hotelToday(now, hotel.timezone);
    return this.within(hotel, today, addIsoDays(today, 30), now);
  }

  /** Find a holiday in the date window the hotelier is currently reviewing. */
  async within(hotel: Hotel, from: string, through: string, now: Date): Promise<HolidayRateAdviceResult> {
    const result = await this.allWithin(hotel, from, through, now);
    if (result.status !== 'ready') return result;
    return result.holidays[0] ?? { status: 'none' };
  }

  /** Every applicable national public holiday in the hotel's date window. */
  async allWithin(hotel: Hotel, from: string, through: string, now: Date): Promise<HolidayRateAdviceListResult> {
    const countryCode = hotelCountryCode(hotel.location);
    if (!countryCode) return { status: 'unknown_country' };
    const today = hotelToday(now, hotel.timezone);
    const start = Date.parse(`${today}T00:00:00Z`);
    const years = [...new Set([Number(from.slice(0, 4)), Number(through.slice(0, 4))])];
    const calendars = await Promise.all(years.map((year) => this.calendar.list(countryCode, year)));
    if (calendars.some((calendar) => calendar === null)) return { status: 'unavailable' };
    const upcoming = calendars.flatMap((calendar) => calendar ?? [])
      .filter((holiday) => holiday.date >= from && holiday.date <= through && holiday.nationalHoliday && holiday.holidayTypes.includes('Public'))
      .sort((a, b) => a.date.localeCompare(b.date));
    const countryName = new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) ?? countryCode;
    return {
      status: 'ready',
      holidays: upcoming.map((holiday) => ({
        status: 'ready' as const,
        date: holiday.date,
        holidayName: holiday.name,
        countryCode,
        countryName,
        daysAway: Math.round((Date.parse(`${holiday.date}T00:00:00Z`) - start) / 86_400_000),
        ratesHref: `/admin/rates?tab=holidays&from=${holiday.date}&days=7`,
      })),
    };
  }
}
