import type { GuestDocument, GuestDocumentStore } from '@/lib/domain/guest-document';
import { getDemoDatabase } from './cloudflare-env';
import { ensureSchema } from './d1-schema';

export const guestDocumentStore: GuestDocumentStore = {
  async get(hotelId, id) {
    const db = getDemoDatabase();
    if (!db) return null;
    await ensureSchema(db);
    const row = await db.prepare('SELECT data FROM guest_documents WHERE hotel_id = ? AND id = ?').bind(hotelId, id).first<{ data: string }>();
    return row ? JSON.parse(row.data) as GuestDocument : null;
  },
  async list(hotelId) {
    const db = getDemoDatabase();
    if (!db) return [];
    await ensureSchema(db);
    const statement = hotelId ? db.prepare('SELECT data FROM guest_documents WHERE hotel_id = ?').bind(hotelId) : db.prepare('SELECT data FROM guest_documents');
    const { results } = await statement.all<{ data: string }>();
    return results.map((row) => JSON.parse(row.data) as GuestDocument);
  },
  async save(document) {
    const db = getDemoDatabase();
    // Persistent files require persistent deletion records. A memory fallback
    // could orphan passport images on the next process restart.
    if (!db) throw new Error('Durable document storage is unavailable.');
    await ensureSchema(db);
    await db.prepare(`INSERT INTO guest_documents (id, hotel_id, data) VALUES (?, ?, ?) ON CONFLICT (hotel_id, id) DO UPDATE SET data = CASE WHEN json_extract(guest_documents.data, '$.deletionReason') IS NOT NULL AND json_extract(excluded.data, '$.deletionReason') IS NULL THEN guest_documents.data ELSE excluded.data END`).bind(document.id, document.hotelId, JSON.stringify(document)).run();
  },
};
