import type { HousekeepingStore } from '../domain/ports';
import { getDemoDatabase } from './cloudflare-env';
import * as d1 from './housekeeping-store-d1';
import { mockHousekeepingStore } from './housekeeping-store-mock';

/**
 * The housekeeping store the app actually uses. Resolves the D1 binding at
 * call time and reads through D1 when one is configured, falling back to
 * the in-memory mock otherwise — same shape as `durable-role-store.ts`.
 */
export const durableHousekeepingStore: HousekeepingStore = {
  listRecords(hotelId) {
    const db = getDemoDatabase();
    return db ? d1.listRecords(db, hotelId) : mockHousekeepingStore.listRecords(hotelId);
  },
  setRecord(record) {
    const db = getDemoDatabase();
    return db ? d1.setRecord(db, record) : mockHousekeepingStore.setRecord(record);
  },
};
