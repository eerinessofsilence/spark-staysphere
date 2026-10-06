import { describe, expect, it } from 'vitest';
import { parseDashboardPeriod } from './dashboard-period';

describe('parseDashboardPeriod', () => {
  const today = '2026-09-30';

  it('uses the next seven days by default', () => {
    expect(parseDashboardPeriod(undefined, undefined, undefined, today)).toEqual({
      key: 'next_7',
      from: '2026-09-30',
      to: '2026-10-06',
      days: 7,
    });
  });

  it('supports today and the next thirty days', () => {
    expect(parseDashboardPeriod('today', undefined, undefined, today).days).toBe(1);
    expect(parseDashboardPeriod('next_30', undefined, undefined, today).to).toBe('2026-10-29');
  });

  it('keeps a valid custom period inside the dashboard window', () => {
    expect(parseDashboardPeriod('custom', '2026-10-02', '2026-10-12', today)).toEqual({
      key: 'custom',
      from: '2026-10-02',
      to: '2026-10-12',
      days: 11,
    });
  });

  it('rejects past, reversed and overlong custom periods', () => {
    for (const [from, to] of [
      ['2026-09-29', '2026-10-02'],
      ['2026-10-03', '2026-10-02'],
      ['2026-09-30', '2026-12-29'],
    ]) {
      expect(parseDashboardPeriod('custom', from, to, today)).toMatchObject({ key: 'next_7', invalid: true });
    }
  });
});
