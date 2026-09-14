import type { CSSProperties } from 'react';

export const WINDOW_OPTIONS = [7, 14, 30] as const;
export const DEFAULT_WINDOW = 14;

export interface TapeChartQuery {
  from: string;
  days: number;
  type: string | null;
}

export function tapeChartHref({ from, days, type }: TapeChartQuery): string {
  const params = new URLSearchParams({ from, days: String(days) });
  if (type) params.set('type', type);
  return `/admin/tape-chart?${params.toString()}`;
}

/** A hatch drawn from the foreground token, so demand reads as a pattern, not only a colour. */
export const demandPattern: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(135deg, color-mix(in oklab, var(--foreground) 14%, transparent) 0 1.5px, transparent 1.5px 6px)',
};
