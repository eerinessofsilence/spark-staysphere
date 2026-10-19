const statements = [
  'CREATE TABLE IF NOT EXISTS catalog_entries (kind TEXT NOT NULL, id TEXT NOT NULL, hotel_id TEXT NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (kind, id))',
  'CREATE INDEX IF NOT EXISTS idx_catalog_entries_hotel ON catalog_entries (hotel_id, kind)',
  'CREATE TABLE IF NOT EXISTS spinner_zones (id TEXT PRIMARY KEY, hotel_id TEXT NOT NULL, frame_index INTEGER NOT NULL, polygon TEXT NOT NULL, target TEXT, updated_at TEXT NOT NULL)',
  'CREATE INDEX IF NOT EXISTS idx_spinner_zones_hotel ON spinner_zones (hotel_id, frame_index)',
];
const initialized = new WeakMap<D1Database, Promise<void>>();
export async function ensureSchema(db: D1Database): Promise<void> {
  let pending = initialized.get(db);
  if (!pending) {
    pending = db.batch(statements.map((sql) => db.prepare(sql))).then(() => {}).catch((error) => { initialized.delete(db); throw error; });
    initialized.set(db, pending);
  }
  await pending;
}
