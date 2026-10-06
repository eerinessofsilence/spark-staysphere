import { describe, expect, it } from 'vitest';
import { parseReportPeriod } from './report-period';

describe('report period', () => {
  it('uses the previous complete Monday–Sunday week', () => {
    expect(parseReportPeriod('last_week', undefined, undefined, '2026-09-24')).toEqual({
      key: 'last_week', from: '2026-09-14', to: '2026-09-20',
    });
  });

  it('crosses year boundaries for last month', () => {
    expect(parseReportPeriod('last_month', undefined, undefined, '2026-01-05')).toEqual({
      key: 'last_month', from: '2025-12-01', to: '2025-12-31',
    });
  });

  it('keeps valid custom dates and rejects reversed or nonexistent dates', () => {
    expect(parseReportPeriod('custom', '2026-09-01', '2026-09-10', '2026-09-24')).toEqual({
      key: 'custom', from: '2026-09-01', to: '2026-09-10',
    });
    expect(parseReportPeriod('custom', '2026-09-10', '2026-09-01', '2026-09-24').key).toBe('yesterday');
    expect(parseReportPeriod('custom', '2026-02-30', '2026-03-01', '2026-09-24').key).toBe('yesterday');
  });
});
