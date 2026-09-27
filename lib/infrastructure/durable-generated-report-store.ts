import type { GeneratedReportStore } from '../domain/ports';
import { getDemoDatabase } from './cloudflare-env';
import * as d1 from './generated-report-store-d1';
import { mockGeneratedReportStore } from './generated-report-store-mock';

/**
 * The generated-report store the app actually uses. Resolves the D1 binding
 * at call time and reads through D1 when one is configured, falling back to
 * the in-memory mock otherwise — same shape as `durable-housekeeping-store.ts`.
 */
export const durableGeneratedReportStore: GeneratedReportStore = {
  list(hotelId) {
    const db = getDemoDatabase();
    return db ? d1.list(db, hotelId) : mockGeneratedReportStore.list(hotelId);
  },
  get(hotelId, id) {
    const db = getDemoDatabase();
    return db ? d1.get(db, hotelId, id) : mockGeneratedReportStore.get(hotelId, id);
  },
  save(report) {
    const db = getDemoDatabase();
    return db ? d1.save(db, report) : mockGeneratedReportStore.save(report);
  },
};
