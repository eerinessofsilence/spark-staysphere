import { z } from 'zod';
import type { PublicHolidayPort } from '@/lib/domain/ports';

const holidaySchema = z.array(z.object({
  date: z.iso.date(),
  name: z.string().min(1),
  nationalHoliday: z.boolean(),
  holidayTypes: z.array(z.string()),
}));

const verifiedCyprusHolidays: Record<number, Array<{ date: string; name: string; nationalHoliday: boolean; holidayTypes: string[] }>> = {
  // Demo continuity when the external calendar is unreachable. These dates
  // are published by CySEC and Visit Cyprus; other years/countries do not guess.
  // https://www.cysec.gov.cy/en-GB/cysec/about-us/public-holidays/
  // https://www.visitcyprus.com/useful-info/time-working-hours-holidays/
  2026: [
    { date: '2026-10-28', name: 'Greek National Anniversary Day', nationalHoliday: true, holidayTypes: ['Public'] },
    { date: '2026-12-25', name: 'Christmas Day', nationalHoliday: true, holidayTypes: ['Public'] },
    { date: '2026-12-26', name: 'Boxing Day', nationalHoliday: true, holidayTypes: ['Public'] },
  ],
  2027: [
    { date: '2027-01-01', name: "New Year's Day", nationalHoliday: true, holidayTypes: ['Public'] },
  ],
};

function verifiedFallback(countryCode: string, year: number) {
  return countryCode === 'CY' ? verifiedCyprusHolidays[year] ?? null : null;
}

/** Official Nager.Holidays calendar; cached daily and never treated as a pricing feed. */
export const nagerPublicHolidays: PublicHolidayPort = {
  async list(countryCode, year) {
    if (!/^[A-Z]{2}$/.test(countryCode) || !Number.isInteger(year) || year < 2000 || year > 2100) return null;
    try {
      const response = await fetch(`https://nagerholidays.com/api/v4/Holidays/${countryCode}/${year}`, {
        next: { revalidate: 86_400 },
        signal: AbortSignal.timeout(4_000),
      });
      if (!response.ok) return verifiedFallback(countryCode, year);
      const parsed = holidaySchema.safeParse(await response.json());
      return parsed.success ? parsed.data : verifiedFallback(countryCode, year);
    } catch {
      return verifiedFallback(countryCode, year);
    }
  },
};
