import { addIsoDays } from '../domain/dates';

export type ReportPeriodKey = 'yesterday' | 'last_week' | 'last_month' | 'custom';

export interface ReportPeriod {
  key: ReportPeriodKey;
  from: string;
  to: string;
  invalid?: boolean;
}

function validIsoDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

/** Calendar periods in the hotel's current date. Dates in the URL remain bookmarkable. */
export function parseReportPeriod(
  period: string | string[] | undefined,
  from: string | string[] | undefined,
  to: string | string[] | undefined,
  today: string,
): ReportPeriod {
  const key = Array.isArray(period) ? period[0] : period;
  if (key === 'last_week') {
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
    const monday = addIsoDays(today, -(weekday === 0 ? 6 : weekday - 1) - 7);
    return { key, from: monday, to: addIsoDays(monday, 6) };
  }
  if (key === 'last_month') {
    const [year, month] = today.split('-').map(Number);
    const previous = new Date(Date.UTC(year, month - 2, 1));
    const last = new Date(Date.UTC(year, month - 1, 0));
    return { key, from: previous.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
  }
  if (key === 'custom') {
    const first = Array.isArray(from) ? from[0] : from;
    const last = Array.isArray(to) ? to[0] : to;
    if (first && last && validIsoDay(first) && validIsoDay(last) && first <= last) {
      const days = (Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000;
      if (days <= 366) return { key, from: first, to: last };
    }
  }
  const yesterday = addIsoDays(today, -1);
  return { key: 'yesterday', from: yesterday, to: yesterday, ...(key === 'custom' ? { invalid: true } : {}) };
}
