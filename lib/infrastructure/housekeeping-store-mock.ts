import type { HousekeepingRecord, HousekeepingStore } from '../domain/ports';

/**
 * Process-local fallback for `HousekeepingStore` — the same semantics as
 * `housekeeping-store-d1.ts`, used whenever no D1 binding is configured
 * (see `durable-housekeeping-store.ts`).
 */
const records = new Map<string, HousekeepingRecord>();

export const mockHousekeepingStore: HousekeepingStore = {
  async listRecords(hotelId) {
    return [...records.values()].filter((record) => record.hotelId === hotelId);
  },
  async setRecord(record) {
    records.set(record.unitId, record);
  },
};
