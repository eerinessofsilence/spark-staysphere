import type { ReportPeriodView, ReportType } from './ports';

/** In the order the "Report type" picker lists them. */
export const REPORT_TYPES: readonly ReportType[] = ['arrivals', 'departures', 'in_house'];

export function isReportType(value: string): value is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(value);
}

const REPORT_PERIOD_VIEWS: readonly ReportPeriodView[] = ['manager', 'financial', 'ledger', 'statistics'];

export function isReportPeriodView(value: string): value is ReportPeriodView {
  return (REPORT_PERIOD_VIEWS as readonly string[]).includes(value);
}
