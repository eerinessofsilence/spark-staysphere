/**
 * Durable demo state: confirmed bookings, payment attempts, the admin
 * overrides that need to survive a restart, and the CMS content overlay.
 * Applied once per Worker isolate with `CREATE TABLE IF NOT EXISTS` — this
 * project has no migration runner, and idempotent DDL is cheap enough to run
 * on first use rather than requiring a separate `wrangler d1 migrations` step.
 *
 * The room/rate/add-on catalog's *baseline* is NOT here: it stays static seed
 * data in mock-data.ts. `catalog_entries` holds only what a hotel team has
 * edited through `/admin/content` — see `lib/domain/catalog-overlay.ts` for
 * how a row there replaces or extends a seed entity.
 *
 * Each statement is a single line with no embedded newlines: `D1Database.exec`
 * splits its input on `\n`, not `;`, so a multi-line `CREATE TABLE` silently
 * breaks into unparsable fragments. Using `batch()` with one prepared
 * statement per entry sidesteps that entirely.
 */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS subscription_accounts (member_id TEXT PRIMARY KEY, trial_started_at TEXT NOT NULL, trial_ends_at TEXT NOT NULL, demo_ends_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS guest_profile_identities (profile_id TEXT NOT NULL, hotel_id TEXT NOT NULL, identity_json TEXT NOT NULL, PRIMARY KEY (hotel_id, profile_id))`,
  `CREATE TABLE IF NOT EXISTS guest_documents (id TEXT NOT NULL, hotel_id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (hotel_id, id))`,
  `CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, reference TEXT NOT NULL UNIQUE, idempotency_key TEXT NOT NULL UNIQUE, hotel_id TEXT NOT NULL, room_type_id TEXT NOT NULL, rate_plan_id TEXT NOT NULL, check_in TEXT NOT NULL, check_out TEXT NOT NULL, adults INTEGER NOT NULL, children INTEGER NOT NULL, guest_first_name TEXT NOT NULL, guest_last_name TEXT NOT NULL, guest_email TEXT NOT NULL, guest_phone TEXT NOT NULL, add_on_ids TEXT NOT NULL, total REAL NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_hotel_created ON bookings (hotel_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_room_dates ON bookings (room_type_id, status, check_in, check_out)`,
  `CREATE TABLE IF NOT EXISTS booking_guests (id TEXT PRIMARY KEY, booking_id TEXT NOT NULL, category TEXT NOT NULL CHECK (category IN ('adult', 'child')), first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT, phone TEXT, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_booking_guests_booking ON booking_guests (booking_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS payment_attempts (id TEXT PRIMARY KEY, booking_id TEXT NOT NULL, provider TEXT NOT NULL, status TEXT NOT NULL, amount REAL NOT NULL, currency TEXT NOT NULL, vat_rate REAL, comment TEXT, created_at TEXT, refund_scope TEXT, refund_item_ids TEXT, refund_reason TEXT, receipt_number TEXT, operator_id TEXT, operator_name TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_payment_attempts_booking ON payment_attempts (booking_id)`,
  `CREATE TABLE IF NOT EXISTS room_status_overrides (room_type_id TEXT PRIMARY KEY, status TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS inventory_holds (room_type_id TEXT NOT NULL, date TEXT NOT NULL, held INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (room_type_id, date))`,
  `CREATE TABLE IF NOT EXISTS booking_mutation_guards (id TEXT PRIMARY KEY)`,
  `CREATE TABLE IF NOT EXISTS catalog_entries (kind TEXT NOT NULL, id TEXT NOT NULL, hotel_id TEXT NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (kind, id))`,
  `CREATE INDEX IF NOT EXISTS idx_catalog_entries_hotel ON catalog_entries (hotel_id, kind)`,
  `CREATE TABLE IF NOT EXISTS rate_change_events (id TEXT PRIMARY KEY, hotel_id TEXT NOT NULL, rate_id TEXT NOT NULL, rate_name TEXT NOT NULL, room_type_id TEXT NOT NULL, actor_name TEXT NOT NULL, description TEXT NOT NULL, occurred_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_rate_change_events_hotel ON rate_change_events (hotel_id, occurred_at DESC)`,
  `CREATE TABLE IF NOT EXISTS booking_units (booking_id TEXT PRIMARY KEY, unit_number TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_booking_units_unit ON booking_units (unit_number, booking_id)`,
  `CREATE TABLE IF NOT EXISTS booking_room_assignments (booking_id TEXT PRIMARY KEY, assignments TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS booking_stay_states (booking_id TEXT PRIMARY KEY, state TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS booking_stay_times (booking_id TEXT PRIMARY KEY, check_in_time TEXT NOT NULL, check_out_time TEXT NOT NULL, late_check_in INTEGER NOT NULL, late_check_out INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS booking_cancellation_reasons (booking_id TEXT PRIMARY KEY, reason TEXT NOT NULL, cancelled_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS booking_groups (id TEXT PRIMARY KEY, hotel_id TEXT NOT NULL, name TEXT NOT NULL, notes TEXT, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_booking_groups_hotel ON booking_groups (hotel_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS booking_group_members (booking_id TEXT PRIMARY KEY, group_id TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_booking_group_members_group ON booking_group_members (group_id)`,
  `CREATE TABLE IF NOT EXISTS guest_profiles (id TEXT PRIMARY KEY, hotel_id TEXT NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_guest_profiles_hotel ON guest_profiles (hotel_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS team_roles (id TEXT PRIMARY KEY, name TEXT NOT NULL, permissions TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS member_role_overrides (member_id TEXT PRIMARY KEY, role_id TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS team_members (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, role TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS housekeeping_states (unit_id TEXT PRIMARY KEY, hotel_id TEXT NOT NULL, status TEXT NOT NULL, note TEXT, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_housekeeping_states_hotel ON housekeeping_states (hotel_id)`,
  `CREATE TABLE IF NOT EXISTS housekeeping_assignments (hotel_id TEXT NOT NULL, unit_id TEXT NOT NULL, member_id TEXT NOT NULL, PRIMARY KEY (hotel_id, unit_id))`,
  `CREATE INDEX IF NOT EXISTS idx_housekeeping_assignments_member ON housekeeping_assignments (hotel_id, member_id)`,
  `CREATE TABLE IF NOT EXISTS housekeeping_demo_seed (hotel_id TEXT PRIMARY KEY)`,
  `CREATE TABLE IF NOT EXISTS housekeeping_events (id TEXT PRIMARY KEY, hotel_id TEXT NOT NULL, unit_id TEXT NOT NULL, room_number TEXT NOT NULL, member_id TEXT NOT NULL, status TEXT NOT NULL, note TEXT, occurred_at TEXT NOT NULL, photo_data TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_housekeeping_events_room ON housekeeping_events (hotel_id, unit_id, occurred_at)`,
  `CREATE TABLE IF NOT EXISTS spinner_zones (id TEXT PRIMARY KEY, hotel_id TEXT NOT NULL, frame_index INTEGER NOT NULL, polygon TEXT NOT NULL, target TEXT, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_spinner_zones_hotel ON spinner_zones (hotel_id, frame_index)`,
  `CREATE TABLE IF NOT EXISTS generated_reports (id TEXT PRIMARY KEY, hotel_id TEXT NOT NULL, type TEXT NOT NULL, date TEXT NOT NULL, generated_at TEXT NOT NULL, generated_by TEXT NOT NULL, rows TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_generated_reports_hotel ON generated_reports (hotel_id, generated_at)`,
  `CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, hotel_id TEXT NOT NULL, channel TEXT NOT NULL, guest_name TEXT NOT NULL, guest_email TEXT NOT NULL, guest_phone TEXT, booking_reference TEXT, last_message TEXT NOT NULL, last_message_at TEXT NOT NULL, unread INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_hotel ON conversations (hotel_id, last_message_at)`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_unread ON conversations (hotel_id, unread)`,
  `CREATE TABLE IF NOT EXISTS conversation_messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, sender TEXT NOT NULL, author TEXT NOT NULL, body TEXT NOT NULL, sent_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_conversation_messages_thread ON conversation_messages (conversation_id, sent_at)`,
  `CREATE TABLE IF NOT EXISTS outbound_delivery_status (message_id TEXT PRIMARY KEY, status TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS email_automation_rules (id TEXT PRIMARY KEY, hotel_id TEXT NOT NULL, trigger_kind TEXT NOT NULL, trigger_days INTEGER, enabled INTEGER NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, built_in INTEGER NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_email_automation_rules_hotel ON email_automation_rules (hotel_id)`,
  `CREATE TABLE IF NOT EXISTS automation_sends (hotel_id TEXT NOT NULL, rule_id TEXT NOT NULL, booking_id TEXT NOT NULL, sent_at TEXT NOT NULL, PRIMARY KEY (rule_id, booking_id))`,
];

const ready = new WeakMap<D1Database, Promise<void>>();

/** Idempotent, memoized per D1 binding instance for the life of the isolate. */
export function ensureSchema(db: D1Database): Promise<void> {
  let promise = ready.get(db);
  if (!promise) {
    promise = db
      .batch(STATEMENTS.map((statement) => db.prepare(statement)))
      .then(async () => {
        // A preview may have created this new table before the late-arrival
        // flags were added. CREATE IF NOT EXISTS does not add columns.
        const columns = await db.prepare('PRAGMA table_info(booking_stay_times)').all<{ name: string }>();
        const names = new Set(columns.results.map((column) => column.name));
        for (const [name, sql] of [
          ['late_check_in', 'ALTER TABLE booking_stay_times ADD COLUMN late_check_in INTEGER'],
          ['late_check_out', 'ALTER TABLE booking_stay_times ADD COLUMN late_check_out INTEGER'],
        ] as const) {
          if (names.has(name)) continue;
          try { await db.prepare(sql).run(); }
          catch (error) {
            // Another Worker may have completed the same idempotent upgrade.
            if (!(error instanceof Error) || !error.message.includes('duplicate column name')) throw error;
          }
        }
        const paymentColumns = await db.prepare('PRAGMA table_info(payment_attempts)').all<{ name: string }>();
        const paymentNames = new Set(paymentColumns.results.map((column) => column.name));
        for (const [name, sql] of [
          ['vat_rate', 'ALTER TABLE payment_attempts ADD COLUMN vat_rate REAL'],
          ['comment', 'ALTER TABLE payment_attempts ADD COLUMN comment TEXT'],
          ['created_at', 'ALTER TABLE payment_attempts ADD COLUMN created_at TEXT'],
          ['refund_scope', 'ALTER TABLE payment_attempts ADD COLUMN refund_scope TEXT'],
          ['refund_item_ids', 'ALTER TABLE payment_attempts ADD COLUMN refund_item_ids TEXT'],
          ['refund_reason', 'ALTER TABLE payment_attempts ADD COLUMN refund_reason TEXT'],
          ['receipt_number', 'ALTER TABLE payment_attempts ADD COLUMN receipt_number TEXT'],
          ['operator_id', 'ALTER TABLE payment_attempts ADD COLUMN operator_id TEXT'],
          ['operator_name', 'ALTER TABLE payment_attempts ADD COLUMN operator_name TEXT'],
        ] as const) {
          if (paymentNames.has(name)) continue;
          try { await db.prepare(sql).run(); }
          catch (error) { if (!(error instanceof Error) || !error.message.includes('duplicate column name')) throw error; }
        }
      })
      .catch((error) => {
        // Don't cache a failed bootstrap — a transient D1 error would
        // otherwise fail every call for the rest of the isolate's life.
        ready.delete(db);
        throw error;
      });
    ready.set(db, promise);
  }
  return promise;
}
