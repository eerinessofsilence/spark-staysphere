import type { AutomationSettingsStore, EmailAutomationKind } from '../domain/ports';

/**
 * Process-local fallback for `AutomationSettingsStore` — same semantics as
 * `automation-settings-store-d1.ts`, used whenever no D1 binding is
 * configured (see `durable-automation-settings-store.ts`).
 */
const settings = new Map<string, boolean>();

function key(hotelId: string, kind: EmailAutomationKind): string {
  return `${hotelId}:${kind}`;
}

export const mockAutomationSettingsStore: AutomationSettingsStore = {
  async list(hotelId) {
    const result: Partial<Record<EmailAutomationKind, boolean>> = {};
    for (const [storedKey, enabled] of settings) {
      const [storedHotelId, kind] = storedKey.split(':') as [string, EmailAutomationKind];
      if (storedHotelId === hotelId) result[kind] = enabled;
    }
    return result;
  },
  async set(hotelId, kind, enabled) {
    settings.set(key(hotelId, kind), enabled);
  },
};
