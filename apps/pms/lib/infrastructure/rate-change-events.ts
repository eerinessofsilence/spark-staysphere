import { getDemoDatabase } from './cloudflare-env';
import { ensureSchema } from './d1-schema';
import type { RateChangeEvent } from '../domain/rate-change-event';

const memory = new Map<string, RateChangeEvent[]>();

export async function recordRateChange(event: RateChangeEvent): Promise<void> {
  const db = getDemoDatabase();
  if (db) {
    await ensureSchema(db);
    await db.prepare('INSERT INTO rate_change_events (id, hotel_id, rate_id, rate_name, room_type_id, actor_name, description, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(event.id, event.hotelId, event.rateId, event.rateName, event.roomTypeId, event.actorName, event.description, event.occurredAt).run();
    return;
  }
  const current = memory.get(event.hotelId) ?? [];
  memory.set(event.hotelId, [event, ...current].slice(0, 50));
}

export async function listRateChanges(hotelId: string, limit = 20): Promise<RateChangeEvent[]> {
  const db = getDemoDatabase();
  if (!db) return (memory.get(hotelId) ?? []).slice(0, limit);
  await ensureSchema(db);
  const { results } = await db.prepare('SELECT id, hotel_id, rate_id, rate_name, room_type_id, actor_name, description, occurred_at FROM rate_change_events WHERE hotel_id = ? ORDER BY occurred_at DESC LIMIT ?')
    .bind(hotelId, limit).all<{ id: string; hotel_id: string; rate_id: string; rate_name: string; room_type_id: string; actor_name: string; description: string; occurred_at: string }>();
  return results.map((row) => ({ id: row.id, hotelId: row.hotel_id, rateId: row.rate_id, rateName: row.rate_name, roomTypeId: row.room_type_id, actorName: row.actor_name, description: row.description, occurredAt: row.occurred_at }));
}
