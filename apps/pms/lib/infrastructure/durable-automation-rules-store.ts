import type { AutomationRuleStore } from '../domain/ports';
import { getDemoDatabase } from './cloudflare-env';
import * as d1 from './automation-rules-store-d1';
import { mockAutomationRuleStore } from './automation-rules-store-mock';

/**
 * The rules behind `/admin/settings/automations` — the four built-in ones
 * plus whatever a hotel team creates. Resolves the D1 binding at call time
 * and reads through D1 when one is configured, falling back to the
 * in-memory mock otherwise — same shape as `durable-role-store.ts`.
 */
export const durableAutomationRuleStore: AutomationRuleStore = {
  list(hotelId) {
    const db = getDemoDatabase();
    return db ? d1.list(db, hotelId) : mockAutomationRuleStore.list(hotelId);
  },
  upsert(rule) {
    const db = getDemoDatabase();
    return db ? d1.upsert(db, rule) : mockAutomationRuleStore.upsert(rule);
  },
  delete(hotelId, id) {
    const db = getDemoDatabase();
    return db ? d1.deleteRule(db, hotelId, id) : mockAutomationRuleStore.delete(hotelId, id);
  },
};
