import type { SpinnerZone, SpinnerZoneTarget } from '../domain/spinner-markup';
import { ensureSchema } from './d1-schema';

/**
 * D1-backed reads and writes for spinner-markup zones. Same shape as
 * `catalog-content-d1.ts`: plain `(db, ...args)` functions dispatched by
 * `durable-spinner-markup.ts`, nothing here decides whether D1 is in use.
 */

interface SpinnerZoneRow {
  id: string;
  hotel_id: string;
  frame_index: number;
  polygon: string;
  target: string | null;
  updated_at: string;
}

function rowToZone(row: SpinnerZoneRow): SpinnerZone {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    frameIndex: row.frame_index,
    polygon: JSON.parse(row.polygon),
    target: row.target ? (JSON.parse(row.target) as SpinnerZoneTarget) : null,
    updatedAt: row.updated_at,
  };
}

export async function listZones(db: D1Database, hotelId: string): Promise<SpinnerZone[]> {
  await ensureSchema(db);
  const { results } = await db
    .prepare('SELECT * FROM spinner_zones WHERE hotel_id = ? ORDER BY frame_index, id')
    .bind(hotelId)
    .all<SpinnerZoneRow>();
  return results.map(rowToZone);
}

export async function applyZoneBatch(
  db: D1Database,
  hotelId: string,
  batch: { upserts: Array<{ id: string; frameIndex: number; polygon: unknown; target: unknown }>; deletes: string[] },
): Promise<void> {
  await ensureSchema(db);
  const now = new Date().toISOString();
  const statements = [
    ...(batch.deletes.length > 0
      ? [
          db
            .prepare(`DELETE FROM spinner_zones WHERE hotel_id = ? AND id IN (${batch.deletes.map(() => '?').join(',')})`)
            .bind(hotelId, ...batch.deletes),
        ]
      : []),
    ...batch.upserts.map((row) =>
      db
        .prepare(
          `INSERT INTO spinner_zones (id, hotel_id, frame_index, polygon, target, updated_at) VALUES (?,?,?,?,?,?)
           ON CONFLICT (id) DO UPDATE SET
             frame_index = excluded.frame_index, polygon = excluded.polygon, target = excluded.target, updated_at = excluded.updated_at
           WHERE spinner_zones.hotel_id = excluded.hotel_id`,
        )
        .bind(row.id, hotelId, row.frameIndex, JSON.stringify(row.polygon), row.target ? JSON.stringify(row.target) : null, now),
    ),
  ];
  if (statements.length > 0) await db.batch(statements);
}

export async function reset(db: D1Database, hotelId: string): Promise<void> {
  await ensureSchema(db);
  await db.prepare('DELETE FROM spinner_zones WHERE hotel_id = ?').bind(hotelId).run();
}
