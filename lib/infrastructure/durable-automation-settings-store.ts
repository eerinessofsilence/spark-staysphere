import type { AutomationSettingsStore } from '../domain/ports';
import { getDemoDatabase } from './cloudflare-env';
import * as d1 from './automation-settings-store-d1';
import { mockAutomationSettingsStore } from './automation-settings-store-mock';

/**
 * The on/off switches for `/admin/settings/automations`. Resolves the D1
 * binding at call time and reads through D1 when one is configured, falling
 * back to the in-memory mock otherwise — same shape as `durable-role-store.ts`.
 */
export const durableAutomationSettingsStore: AutomationSettingsStore = {
  list(hotelId) {
    const db = getDemoDatabase();
    return db ? d1.list(db, hotelId) : mockAutomationSettingsStore.list(hotelId);
  },
  set(hotelId, kind, enabled) {
    const db = getDemoDatabase();
    return db ? d1.set(db, hotelId, kind, enabled) : mockAutomationSettingsStore.set(hotelId, kind, enabled);
  },
};
