import type { GeneratedReport, GeneratedReportStore } from '../domain/ports';

/**
 * Process-local fallback for `GeneratedReportStore` — the same semantics as
 * `generated-report-store-d1.ts`, used whenever no D1 binding is configured
 * (see `durable-generated-report-store.ts`).
 */
const reports = new Map<string, GeneratedReport>();

export const mockGeneratedReportStore: GeneratedReportStore = {
  async list(hotelId) {
    return [...reports.values()].filter((report) => report.hotelId === hotelId);
  },
  async get(hotelId, id) {
    const report = reports.get(id);
    return report && report.hotelId === hotelId ? report : null;
  },
  async save(report) {
    reports.set(report.id, report);
  },
};
