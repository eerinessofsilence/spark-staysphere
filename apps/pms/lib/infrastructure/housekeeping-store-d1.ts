import type { HousekeepingAssignment, HousekeepingEvent, HousekeepingRecord } from '../domain/ports';
import type { HousekeepingStatus } from '../domain/schemas';
import { ensureSchema } from './d1-schema';
import { demoHousekeepingAssignments } from './demo-housekeeping-assignments';

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

export async function listAssignments(db: D1Database, hotelId: string): Promise<HousekeepingAssignment[]> {
  await ensureSchema(db);
  const demo = demoHousekeepingAssignments.filter((assignment) => assignment.hotelId === hotelId);
  if (demo.length) {
    await db.batch([
      ...demo.map((assignment) => db.prepare(`INSERT OR IGNORE INTO housekeeping_assignments (hotel_id, unit_id, member_id)
        SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM housekeeping_demo_seed WHERE hotel_id = ?)`)
        .bind(hotelId, assignment.unitId, assignment.memberId, hotelId)),
      db.prepare('INSERT OR IGNORE INTO housekeeping_demo_seed (hotel_id) VALUES (?)').bind(hotelId),
    ]);
  }
  const { results } = await db.prepare('SELECT hotel_id, unit_id, member_id FROM housekeeping_assignments WHERE hotel_id = ?')
    .bind(hotelId).all<{ hotel_id: string; unit_id: string; member_id: string }>();
  return results.map((row) => ({ hotelId: row.hotel_id, unitId: row.unit_id, memberId: row.member_id }));
}

export async function setAssignment(db: D1Database, assignment: HousekeepingAssignment | { hotelId: string; unitId: string; memberId: null }): Promise<void> {
  await ensureSchema(db);
  if (assignment.memberId === null) {
    await db.prepare('DELETE FROM housekeeping_assignments WHERE hotel_id = ? AND unit_id = ?').bind(assignment.hotelId, assignment.unitId).run();
  } else {
    await db.prepare('INSERT INTO housekeeping_assignments (hotel_id, unit_id, member_id) VALUES (?, ?, ?) ON CONFLICT (hotel_id, unit_id) DO UPDATE SET member_id = excluded.member_id')
      .bind(assignment.hotelId, assignment.unitId, assignment.memberId).run();
  }
}

interface EventRow {
  id: string; hotel_id: string; unit_id: string; room_number: string; member_id: string;
  status: HousekeepingStatus; note: string | null; occurred_at: string; photo_data: string | null;
}

function toEvent(row: EventRow): HousekeepingEvent {
  return { id: row.id, hotelId: row.hotel_id, unitId: row.unit_id, roomNumber: row.room_number,
    memberId: row.member_id, status: row.status, note: row.note, occurredAt: row.occurred_at, photoData: row.photo_data };
}

export async function saveChange(db: D1Database, _record: HousekeepingRecord, event: HousekeepingEvent): Promise<void> {
  await ensureSchema(db);
  // A queued offline change can be retried. Derive the current state from the
  // persisted event, not SQLite changes(): D1 batch statements do not reliably
  // expose the previous statement's changes() value to the next statement.
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO housekeeping_events (id, hotel_id, unit_id, room_number, member_id, status, note, occurred_at, photo_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(event.id, event.hotelId, event.unitId, event.roomNumber, event.memberId, event.status, event.note, event.occurredAt, event.photoData),
    db.prepare(`INSERT INTO housekeeping_states (unit_id, hotel_id, status, note, updated_at)
      SELECT unit_id, hotel_id, status, note, occurred_at FROM housekeeping_events WHERE id = ?
      ON CONFLICT (unit_id) DO UPDATE SET status = excluded.status, note = excluded.note,
        updated_at = excluded.updated_at WHERE excluded.updated_at >= housekeeping_states.updated_at`)
      .bind(event.id),
  ]);
}

export async function listEvents(db: D1Database, hotelId: string, unitId: string): Promise<HousekeepingEvent[]> {
  await ensureSchema(db);
  const { results } = await db.prepare('SELECT * FROM housekeeping_events WHERE hotel_id = ? AND unit_id = ? ORDER BY occurred_at DESC LIMIT 100')
    .bind(hotelId, unitId).all<EventRow>();
  return results.map(toEvent);
}

export async function getEvent(db: D1Database, hotelId: string, id: string): Promise<HousekeepingEvent | null> {
  await ensureSchema(db);
  const row = await db.prepare('SELECT * FROM housekeeping_events WHERE hotel_id = ? AND id = ?')
    .bind(hotelId, id).first<EventRow>();
  return row ? toEvent(row) : null;
}
