import type { HousekeepingAssignment, HousekeepingEvent, HousekeepingRecord, HousekeepingStore } from '../domain/ports';
import { demoHousekeepingAssignments } from './demo-housekeeping-assignments';

/**
 * Process-local fallback for `HousekeepingStore` — the same semantics as
 * `housekeeping-store-d1.ts`, used whenever no D1 binding is configured
 * (see `durable-housekeeping-store.ts`).
 */
const records = new Map<string, HousekeepingRecord>();
const assignments = new Map<string, HousekeepingAssignment>();
for (const assignment of demoHousekeepingAssignments) assignments.set(`${assignment.hotelId}:${assignment.unitId}`, assignment);
const events = new Map<string, HousekeepingEvent>();

export const mockHousekeepingStore: HousekeepingStore = {
  async listRecords(hotelId) {
    return [...records.values()].filter((record) => record.hotelId === hotelId);
  },
  async setRecord(record) {
    records.set(record.unitId, record);
  },
  async listAssignments(hotelId) {
    return [...assignments.values()].filter((assignment) => assignment.hotelId === hotelId);
  },
  async setAssignment(assignment) {
    const key = `${assignment.hotelId}:${assignment.unitId}`;
    if (assignment.memberId === null) assignments.delete(key);
    else assignments.set(key, assignment);
  },
  async saveChange(record, event) {
    if (events.has(event.id)) return;
    events.set(event.id, event);
    records.set(record.unitId, record);
  },
  async listEvents(hotelId, unitId) {
    return [...events.values()].filter((event) => event.hotelId === hotelId && event.unitId === unitId)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  },
  async getEvent(hotelId, id) {
    const event = events.get(id);
    return event?.hotelId === hotelId ? event : null;
  },
};
