import { describe, expect, it } from 'vitest';
import type { PublicHolidayPort } from '@/lib/domain/ports';
import { demoHotel } from '@/lib/infrastructure/mock-data';
import { HolidayRateAdvisor, hotelCountryCode, hotelWeekendDays } from './holiday-rate-advisor';

describe('hotelCountryCode', () => {
  it('resolves the current demo properties and an ISO code', () => {
    expect(hotelCountryCode('Limassol, Cyprus')).toBe('CY');
    expect(hotelCountryCode('Lisbon, Portugal')).toBe('PT');
    expect(hotelCountryCode('Austin, United States')).toBe('US');
    expect(hotelCountryCode('Paris, FR')).toBe('FR');
    expect(hotelCountryCode('Unknown place')).toBeNull();
  });
});

describe('hotelWeekendDays', () => {
  it('uses country-specific weekend days with a safe fallback', () => {
    expect(hotelWeekendDays('CY')).toEqual([6, 7]);
    expect(hotelWeekendDays('SA')).toEqual([5, 6]);
    expect(hotelWeekendDays(null)).toEqual([6, 7]);
  });
});

describe('HolidayRateAdvisor', () => {
  const holiday = (date: string, name: string, nationalHoliday = true, holidayTypes = ['Public']) => ({
    date, name, nationalHoliday, holidayTypes,
  });

  it('suggests reviewing the next national public holiday in the hotel time zone', async () => {
    const calls: Array<[string, number]> = [];
    const calendar: PublicHolidayPort = {
      async list(country, year) {
        calls.push([country, year]);
        return [
          holiday('2026-10-05', 'Local event', false),
          holiday('2026-10-10', 'School break', true, ['School']),
          holiday('2026-10-28', 'Ohi Day'),
        ];
      },
    };
    const result = await new HolidayRateAdvisor(calendar).next(demoHotel, new Date('2026-10-02T22:30:00Z'));
    expect(calls).toEqual([['CY', 2026]]);
    expect(result).toMatchObject({ status: 'ready', date: '2026-10-28', holidayName: 'Ohi Day', daysAway: 25, ratesHref: '/admin/rates?tab=holidays&from=2026-10-28&days=7' });
  });

  it('loads the following year across New Year and never changes a rate', async () => {
    const calendar: PublicHolidayPort = {
      async list(_country, year) { return year === 2027 ? [holiday('2027-01-01', "New Year's Day")] : []; },
    };
    expect(await new HolidayRateAdvisor(calendar).next(demoHotel, new Date('2026-12-20T12:00:00Z')))
      .toMatchObject({ date: '2027-01-01', daysAway: 12 });
  });

  it('finds a holiday in a selected future rate window', async () => {
    const calendar: PublicHolidayPort = {
      async list(_country, year) { return year === 2027 ? [holiday('2027-05-01', 'May Day')] : []; },
    };
    expect(await new HolidayRateAdvisor(calendar).within(demoHotel, '2027-04-28', '2027-05-05', new Date('2026-10-03T12:00:00Z')))
      .toMatchObject({ status: 'ready', date: '2027-05-01', holidayName: 'May Day' });
  });

  it('returns every national public holiday in range, not only the first', async () => {
    const calendar: PublicHolidayPort = {
      async list() { return [
        holiday('2026-12-25', 'Christmas Day'),
        holiday('2026-12-26', 'Boxing Day'),
        holiday('2026-12-27', 'Regional festival', false),
      ]; },
    };
    const result = await new HolidayRateAdvisor(calendar).allWithin(demoHotel, '2026-12-24', '2026-12-28', new Date('2026-12-24T12:00:00Z'));
    expect(result.status === 'ready' ? result.holidays.map((day) => day.date) : null).toEqual(['2026-12-25', '2026-12-26']);
  });

  it('returns no fabricated advice when the provider is unavailable', async () => {
    const calendar: PublicHolidayPort = { async list() { return null; } };
    expect(await new HolidayRateAdvisor(calendar).next(demoHotel, new Date('2026-12-20T12:00:00Z'))).toEqual({ status: 'unavailable' });
  });

  it('distinguishes an empty calendar from an unknown country', async () => {
    const calendar: PublicHolidayPort = { async list() { return []; } };
    const advisor = new HolidayRateAdvisor(calendar);
    expect(await advisor.next(demoHotel, new Date('2026-10-03T12:00:00Z'))).toEqual({ status: 'none' });
    expect(await advisor.next({ ...demoHotel, location: 'Unspecified' }, new Date('2026-10-03T12:00:00Z')))
      .toEqual({ status: 'unknown_country' });
  });
});
