import type { EmailAutomationKind } from '../domain/ports';
import { ensureSchema } from './d1-schema';

interface AutomationRow {
  kind: EmailAutomationKind;
  enabled: number;
}

export async function list(db: D1Database, hotelId: string): Promise<Partial<Record<EmailAutomationKind, boolean>>> {
  await ensureSchema(db);
  const { results } = await db
    .prepare('SELECT kind, enabled FROM email_automations WHERE hotel_id = ?')
    .bind(hotelId)
    .all<AutomationRow>();
  const settings: Partial<Record<EmailAutomationKind, boolean>> = {};
  for (const row of results) settings[row.kind] = row.enabled === 1;
  return settings;
}

export async function set(db: D1Database, hotelId: string, kind: EmailAutomationKind, enabled: boolean): Promise<void> {
  await ensureSchema(db);
  await db
    .prepare(
      `INSERT INTO email_automations (hotel_id, kind, enabled) VALUES (?, ?, ?)
       ON CONFLICT (hotel_id, kind) DO UPDATE SET enabled = excluded.enabled`,
    )
    .bind(hotelId, kind, enabled ? 1 : 0)
    .run();
}
