/**
 * Durable demo state: confirmed bookings, payment attempts, and the admin
 * overrides that need to survive a restart. Applied once per Worker isolate
 * with `CREATE TABLE IF NOT EXISTS` — this project has no migration runner,
 * and idempotent DDL is cheap enough to run on first use rather than
 * requiring a separate `wrangler d1 migrations` step.
 *
 * The room/rate/add-on catalog itself is NOT here: it stays static seed data
 * in mock-data.ts, exactly as before. Only the state a guest or the admin
 * panel actually mutates lives in D1.
 *
 * Each statement is a single line with no embedded newlines: `D1Database.exec`
 * splits its input on `\n`, not `;`, so a multi-line `CREATE TABLE` silently
 * breaks into unparsable fragments. Using `batch()` with one prepared
 * statement per entry sidesteps that entirely.
 */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, idempotency_key TEXT NOT NULL UNIQUE, hotel_id TEXT NOT NULL, room_type_id TEXT NOT NULL, rate_plan_id TEXT NOT NULL, check_in TEXT NOT NULL, check_out TEXT NOT NULL, adults INTEGER NOT NULL, children INTEGER NOT NULL, guest_first_name TEXT NOT NULL, guest_last_name TEXT NOT NULL, guest_email TEXT NOT NULL, guest_phone TEXT NOT NULL, add_on_ids TEXT NOT NULL, total REAL NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS payment_attempts (id TEXT PRIMARY KEY, booking_id TEXT NOT NULL, provider TEXT NOT NULL, status TEXT NOT NULL, amount REAL NOT NULL, currency TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_payment_attempts_booking ON payment_attempts (booking_id)`,
  `CREATE TABLE IF NOT EXISTS room_status_overrides (room_type_id TEXT PRIMARY KEY, status TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS addon_toggles (addon_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS inventory_holds (room_type_id TEXT NOT NULL, date TEXT NOT NULL, held INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (room_type_id, date))`,
];

const ready = new WeakMap<D1Database, Promise<void>>();

/** Idempotent, memoized per D1 binding instance for the life of the isolate. */
export function ensureSchema(db: D1Database): Promise<void> {
  let promise = ready.get(db);
  if (!promise) {
    promise = db.batch(STATEMENTS.map((statement) => db.prepare(statement))).then(() => undefined);
    ready.set(db, promise);
  }
  return promise;
}
