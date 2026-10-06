import type { EmailAutomationRule } from '../domain/ports';
import { ensureSchema } from './d1-schema';

interface RuleRow {
  id: string;
  hotel_id: string;
  trigger_kind: string;
  trigger_days: number | null;
  enabled: number;
  subject: string;
  body: string;
  built_in: number;
  updated_at: string;
}

function rowToRule(row: RuleRow): EmailAutomationRule {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    trigger: { kind: row.trigger_kind as EmailAutomationRule['trigger']['kind'], days: row.trigger_days ?? undefined },
    enabled: row.enabled === 1,
    subject: row.subject,
    body: row.body,
    builtIn: row.built_in === 1,
    updatedAt: row.updated_at,
  };
}

export async function list(db: D1Database, hotelId: string): Promise<EmailAutomationRule[]> {
  await ensureSchema(db);
  const { results } = await db
    .prepare('SELECT * FROM email_automation_rules WHERE hotel_id = ? ORDER BY updated_at ASC')
    .bind(hotelId)
    .all<RuleRow>();
  return results.map(rowToRule);
}

export async function upsert(db: D1Database, rule: EmailAutomationRule): Promise<void> {
  await ensureSchema(db);
  await db
    .prepare(
      `INSERT INTO email_automation_rules (id, hotel_id, trigger_kind, trigger_days, enabled, subject, body, built_in, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         trigger_kind = excluded.trigger_kind, trigger_days = excluded.trigger_days, enabled = excluded.enabled,
         subject = excluded.subject, body = excluded.body, updated_at = excluded.updated_at`,
    )
    .bind(rule.id, rule.hotelId, rule.trigger.kind, rule.trigger.days ?? null, rule.enabled ? 1 : 0, rule.subject, rule.body, rule.builtIn ? 1 : 0, rule.updatedAt)
    .run();
}

export async function deleteRule(db: D1Database, hotelId: string, id: string): Promise<void> {
  await ensureSchema(db);
  await db.prepare('DELETE FROM email_automation_rules WHERE hotel_id = ? AND id = ?').bind(hotelId, id).run();
}
