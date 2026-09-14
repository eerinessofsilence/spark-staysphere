import type { CatalogDeleteResult, CatalogEntryKind, CatalogEntryRecord, CatalogUpsertResult } from '../domain/ports';
import { ensureSchema } from './d1-schema';

/**
 * D1-backed reads and writes for the CMS overlay: one row per
 * `(kind, id)`, `data` holding the full entity as JSON. Every function is a
 * plain `(db, ...args)` call dispatched by `durable-catalog-content.ts`,
 * exactly like `d1-hotel-repository.ts` — nothing here decides whether D1 is
 * in use.
 */

interface CatalogEntryRow {
  kind: string;
  id: string;
  hotel_id: string;
  data: string;
  version: number;
  updated_at: string;
}

function rowToEntry(row: CatalogEntryRow): CatalogEntryRecord {
  return {
    kind: row.kind as CatalogEntryKind,
    id: row.id,
    hotelId: row.hotel_id,
    data: JSON.parse(row.data) as unknown,
    version: row.version,
    updatedAt: row.updated_at,
  };
}

export async function getEntry(
  db: D1Database,
  kind: CatalogEntryKind,
  id: string,
): Promise<CatalogEntryRecord | null> {
  await ensureSchema(db);
  const row = await db
    .prepare('SELECT * FROM catalog_entries WHERE kind = ? AND id = ?')
    .bind(kind, id)
    .first<CatalogEntryRow>();
  return row ? rowToEntry(row) : null;
}

export async function listEntries(
  db: D1Database,
  kind: CatalogEntryKind,
  hotelId: string,
): Promise<CatalogEntryRecord[]> {
  await ensureSchema(db);
  const { results } = await db
    .prepare('SELECT * FROM catalog_entries WHERE kind = ? AND hotel_id = ?')
    .bind(kind, hotelId)
    .all<CatalogEntryRow>();
  return results.map(rowToEntry);
}

/**
 * Optimistic concurrency in two steps: a read to short-circuit an obvious
 * mismatch, then a write guarded by `WHERE version = ?` (or `ON CONFLICT DO
 * NOTHING` for a fresh row) so a write that raced past the read still can't
 * silently clobber a concurrent one — the guard on the write is what actually
 * makes this safe, the read is just to avoid a wasted round trip.
 */
export async function upsertEntry(
  db: D1Database,
  input: { kind: CatalogEntryKind; id: string; hotelId: string; data: unknown; expectedVersion: number },
): Promise<CatalogUpsertResult> {
  await ensureSchema(db);
  const existing = await db
    .prepare('SELECT version FROM catalog_entries WHERE kind = ? AND id = ?')
    .bind(input.kind, input.id)
    .first<{ version: number }>();
  const currentVersion = existing?.version ?? 0;
  if (currentVersion !== input.expectedVersion) {
    return { ok: false, conflict: true, currentVersion };
  }

  const newVersion = currentVersion + 1;
  const now = new Date().toISOString();
  const json = JSON.stringify(input.data);

  if (existing) {
    const result = await db
      .prepare(
        'UPDATE catalog_entries SET data = ?, version = ?, updated_at = ? WHERE kind = ? AND id = ? AND version = ?',
      )
      .bind(json, newVersion, now, input.kind, input.id, currentVersion)
      .run();
    if ((result.meta.changes ?? 0) === 0) {
      const row = await db
        .prepare('SELECT version FROM catalog_entries WHERE kind = ? AND id = ?')
        .bind(input.kind, input.id)
        .first<{ version: number }>();
      return { ok: false, conflict: true, currentVersion: row?.version ?? currentVersion };
    }
  } else {
    const result = await db
      .prepare(
        `INSERT INTO catalog_entries (kind, id, hotel_id, data, version, updated_at) VALUES (?,?,?,?,?,?)
         ON CONFLICT (kind, id) DO NOTHING`,
      )
      .bind(input.kind, input.id, input.hotelId, json, newVersion, now)
      .run();
    if ((result.meta.changes ?? 0) === 0) {
      const row = await db
        .prepare('SELECT version FROM catalog_entries WHERE kind = ? AND id = ?')
        .bind(input.kind, input.id)
        .first<{ version: number }>();
      return { ok: false, conflict: true, currentVersion: row?.version ?? newVersion };
    }
  }

  return { ok: true, version: newVersion };
}

export async function deleteEntry(
  db: D1Database,
  kind: CatalogEntryKind,
  id: string,
  expectedVersion: number,
): Promise<CatalogDeleteResult> {
  await ensureSchema(db);
  const existing = await db
    .prepare('SELECT version FROM catalog_entries WHERE kind = ? AND id = ?')
    .bind(kind, id)
    .first<{ version: number }>();
  const currentVersion = existing?.version ?? 0;
  if (currentVersion !== expectedVersion) {
    return { ok: false, conflict: true, currentVersion };
  }
  await db.prepare('DELETE FROM catalog_entries WHERE kind = ? AND id = ?').bind(kind, id).run();
  return { ok: true };
}

export async function reset(db: D1Database, hotelId: string): Promise<void> {
  await ensureSchema(db);
  await db.prepare('DELETE FROM catalog_entries WHERE hotel_id = ?').bind(hotelId).run();
}
