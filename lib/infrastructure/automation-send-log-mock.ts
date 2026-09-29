import type { AutomationSendLogStore } from '../domain/ports';

/** Process-local fallback for `AutomationSendLogStore` — same semantics as `automation-send-log-d1.ts`. */
const sent = new Set<string>();

function key(ruleId: string, bookingId: string): string {
  return `${ruleId}:${bookingId}`;
}

export const mockAutomationSendLogStore: AutomationSendLogStore = {
  async wasSent(ruleId, bookingId) {
    return sent.has(key(ruleId, bookingId));
  },
  async markSent(_hotelId, ruleId, bookingId) {
    sent.add(key(ruleId, bookingId));
  },
};
