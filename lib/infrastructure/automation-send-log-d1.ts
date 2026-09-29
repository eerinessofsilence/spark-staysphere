import { ensureSchema } from './d1-schema';

export async function wasSent(db: D1Database, ruleId: string, bookingId: string): Promise<boolean> {
  await ensureSchema(db);
  const row = await db.prepare('SELECT 1 FROM automation_sends WHERE rule_id = ? AND booking_id = ?').bind(ruleId, bookingId).first();
  return row !== null;
}

export async function markSent(db: D1Database, hotelId: string, ruleId: string, bookingId: string): Promise<void> {
  await ensureSchema(db);
  await db
    .prepare(
      `INSERT INTO automation_sends (hotel_id, rule_id, booking_id, sent_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (rule_id, booking_id) DO NOTHING`,
    )
    .bind(hotelId, ruleId, bookingId, new Date().toISOString())
    .run();
}
