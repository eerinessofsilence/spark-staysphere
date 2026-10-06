import type { AutomationSendLogStore } from '../domain/ports';
import { getDemoDatabase } from './cloudflare-env';
import * as d1 from './automation-send-log-d1';
import { mockAutomationSendLogStore } from './automation-send-log-mock';

/** Dedup log for the scheduled sweep — same D1-or-mock shape as `durable-automation-rules-store.ts`. */
export const durableAutomationSendLogStore: AutomationSendLogStore = {
  wasSent(ruleId, bookingId) {
    const db = getDemoDatabase();
    return db ? d1.wasSent(db, ruleId, bookingId) : mockAutomationSendLogStore.wasSent(ruleId, bookingId);
  },
  markSent(hotelId, ruleId, bookingId) {
    const db = getDemoDatabase();
    return db ? d1.markSent(db, hotelId, ruleId, bookingId) : mockAutomationSendLogStore.markSent(hotelId, ruleId, bookingId);
  },
};
