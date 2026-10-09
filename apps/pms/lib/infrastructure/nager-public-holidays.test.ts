import { afterEach, describe, expect, it, vi } from 'vitest';
import { nagerPublicHolidays } from './nager-public-holidays';

afterEach(() => vi.unstubAllGlobals());

describe('nagerPublicHolidays', () => {
  it('parses the official API shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { date: '2026-10-28', name: 'Ohi Day', countryCode: 'CY', nationalHoliday: true, subdivisionCodes: null, holidayTypes: ['Public'] },
    ]), { status: 200 })));
    expect(await nagerPublicHolidays.list('CY', 2026)).toEqual([
      { date: '2026-10-28', name: 'Ohi Day', nationalHoliday: true, holidayTypes: ['Public'] },
    ]);
  });

  it('uses only verified Cyprus demo dates when offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect((await nagerPublicHolidays.list('CY', 2026))?.find((day) => day.date === '2026-10-28')?.name)
      .toBe('Greek National Anniversary Day');
    expect(await nagerPublicHolidays.list('PT', 2026)).toBeNull();
  });
});
