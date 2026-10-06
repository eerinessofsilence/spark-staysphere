import { addIsoDays } from '../domain/dates';

export type DashboardPeriodKey = 'today' | 'next_7' | 'next_30' | 'custom';

export interface DashboardPeriod {
  key: DashboardPeriodKey;
  from: string;
  to: string;
  days: number;
  invalid?: boolean;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function validIsoDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function span(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

/**
 * The dashboard is an operational, forward-looking view. Keep its range in
 * the URL, but bound it to the same 90-night window fetched for the front desk
 * so every KPI is derived from one complete data set.
 */
export function parseDashboardPeriod(
  period: string | string[] | undefined,
  from: string | string[] | undefined,
  to: string | string[] | undefined,
  today: string,
): DashboardPeriod {
  const key = first(period);
  if (key === 'today') return { key, from: today, to: today, days: 1 };
  if (key === 'next_30') return { key, from: today, to: addIsoDays(today, 29), days: 30 };
  if (key === 'custom') {
    const firstDay = first(from);
    const lastDay = first(to);
    const windowEnd = addIsoDays(today, 89);
    if (
      firstDay &&
      lastDay &&
      validIsoDay(firstDay) &&
      validIsoDay(lastDay) &&
      firstDay >= today &&
      firstDay <= lastDay &&
      lastDay <= windowEnd
    ) {
      return { key, from: firstDay, to: lastDay, days: span(firstDay, lastDay) };
    }
  }
  return {
    key: 'next_7',
    from: today,
    to: addIsoDays(today, 6),
    days: 7,
    ...(key === 'custom' ? { invalid: true } : {}),
  };
}
