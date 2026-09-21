import type { HousekeepingRecord } from '../domain/ports';
import type { HousekeepingStatus } from '../domain/schemas';
import { ensureSchema } from './d1-schema';

/**
 * D1-backed half of `HousekeepingStore`. Its own table rather than a column
 * on the CMS's `catalog_entries`: a room's cleaning status changes a dozen
 * times a week and is nothing a hotel would version or publish, the same
 * reasoning as `booking_stay_states`.
 */

interface HousekeepingRow {
  unit_id: string;
  hotel_id: string;
  status: HousekeepingStatus;
  note: string | null;
  updated_at: string;
}

function rowToRecord(row: HousekeepingRow): HousekeepingRecord {
  return { unitId: row.unit_id, hotelId: row.hotel_id, status: row.status, note: row.note, updatedAt: row.updated_at };
}

export async function listRecords(db: D1Database, hotelId: string): Promise<HousekeepingRecord[]> {
  await ensureSchema(db);
  const { results } = await db
    .prepare('SELECT unit_id, hotel_id, status, note, updated_at FROM housekeeping_states WHERE hotel_id = ?')
    .bind(hotelId)
    .all<HousekeepingRow>();
  return results.map(rowToRecord);
}

export async function setRecord(db: D1Database, record: HousekeepingRecord): Promise<void> {
  await ensureSchema(db);
  await db
    .prepare(
      `INSERT INTO housekeeping_states (unit_id, hotel_id, status, note, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (unit_id) DO UPDATE SET status = excluded.status, note = excluded.note, updated_at = excluded.updated_at`,
    )
    .bind(record.unitId, record.hotelId, record.status, record.note, record.updatedAt)
    .run();
}
