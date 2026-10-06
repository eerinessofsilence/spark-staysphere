import type { AutomationRuleStore, EmailAutomationRule } from '../domain/ports';

/**
 * Process-local fallback for `AutomationRuleStore` — same semantics as
 * `automation-rules-store-d1.ts`, used whenever no D1 binding is configured
 * (see `durable-automation-rules-store.ts`).
 */
const rules = new Map<string, EmailAutomationRule>();

export const mockAutomationRuleStore: AutomationRuleStore = {
  async list(hotelId) {
    return [...rules.values()].filter((rule) => rule.hotelId === hotelId).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  },
  async upsert(rule) {
    rules.set(rule.id, rule);
  },
  async delete(hotelId, id) {
    const existing = rules.get(id);
    if (existing?.hotelId === hotelId) rules.delete(id);
  },
};
