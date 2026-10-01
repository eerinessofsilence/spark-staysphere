import {
  bookingGroupSchema,
  bookingSchema,
  guestProfileSchema,
  paymentAttemptSchema,
  roomStatusSchema,
  type Availability,
  type Booking,
  type BookingRoomAssignment,
  type BookingGroup,
  type GuestProfile,
  type PaymentAttempt,
  type RoomStatus,
  type StayState,
} from '../domain/schemas';
import { nightsInRange, resolveRemaining, statusForRemaining } from '../domain/availability';
import { ensureSchema } from './d1-schema';
import type { BookingStore } from '../domain/ports';

/**
 * D1-backed reads and writes for the durable slice of demo state: bookings,
 * payment attempts, admin overrides, and confirmed-booking holds. The
 * room/rate/add-on catalog's *baseline* stays static seed data (mock-data.ts)
 * in every backend; the CMS overlay on top of it lives in
 * `catalog-content-d1.ts`/`catalog-content-mock.ts` instead — this module
 * only holds what a guest or the admin panel's booking-adjacent controls
 * actually mutate. Every function is a plain (db, ...args) call, dispatched
 * to by durable-hotel-repository.ts; nothing here decides whether D1 is in use.
 */

interface BookingRow {
  id: string;
  reference: string;
  idempotency_key: string;
  hotel_id: string;
  room_type_id: string;
  rate_plan_id: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  guest_first_name: string;
  guest_last_name: string;
  guest_email: string;
  guest_phone: string;
  add_on_ids: string;
  total: number;
  currency: string;
  status: string;
  created_at: string;
  unit_number: string | null;
  stay_state: string | null;
  group_id: string | null;
  room_assignments: string | null;
}

// Separate tables rather than new columns: there is no migration runner to ALTER an existing one.
const BOOKING_SELECT =
  'SELECT b.*, u.unit_number, s.state AS stay_state, m.group_id, a.assignments AS room_assignments FROM bookings b LEFT JOIN booking_units u ON u.booking_id = b.id LEFT JOIN booking_stay_states s ON s.booking_id = b.id LEFT JOIN booking_group_members m ON m.booking_id = b.id LEFT JOIN booking_room_assignments a ON a.booking_id = b.id';

function rowToBooking(row: BookingRow): Booking {
  return bookingSchema.parse({
    id: row.id,
    reference: row.reference,
    idempotencyKey: row.idempotency_key,
    hotelId: row.hotel_id,
    roomTypeId: row.room_type_id,
    ratePlanId: row.rate_plan_id,
    checkIn: row.check_in,
    checkOut: row.check_out,
    adults: row.adults,
    children: row.children,
    guest: {
      firstName: row.guest_first_name,
      lastName: row.guest_last_name,
      email: row.guest_email,
      // Older anonymized rows may contain an empty phone; keep them readable
      // while preserving the schema's minimum-length invariant.
      phone: row.guest_phone && row.guest_phone.length >= 7 ? row.guest_phone : '0000000',
    },
    addOnIds: JSON.parse(row.add_on_ids) as string[],
    total: row.total,
    currency: row.currency,
    status: row.status,
    stayState: row.stay_state ?? undefined,
    createdAt: row.created_at,
    unitNumber: row.unit_number ?? undefined,
    roomAssignments: row.room_assignments ? JSON.parse(row.room_assignments) as BookingRoomAssignment[] : undefined,
    groupId: row.group_id ?? undefined,
  });
}

export async function setBookingStayState(
  db: D1Database,
  reference: string,
  state: StayState,
): Promise<Booking | null> {
  await ensureSchema(db);
  const existing = await getBookingByReference(db, reference);
  if (!existing) return null;
  const change = db.prepare(
      `INSERT INTO booking_stay_states (booking_id, state) VALUES (?, ?)
       ON CONFLICT (booking_id) DO UPDATE SET state = excluded.state`,
    )
    .bind(existing.id, state);
  // Persist deletion intent in the same transaction as actual checkout. Undoing
  // checkout later must never resurrect a document or cancel pending erasure.
  if (state === 'checked_out') {
    await db.batch([
      change,
      db.prepare(`UPDATE guest_documents SET data = json_set(data, '$.status', 'pending_deletion', '$.deletionReason', 'reservation_checkout') WHERE hotel_id = ? AND json_extract(data, '$.reservationId') = ? AND json_extract(data, '$.status') != 'deleted'`).bind(existing.hotelId, existing.id),
    ]);
  } else await change.run();
  return { ...existing, stayState: state };
}

export async function saveBookingRoomAssignments(
  db: D1Database,
  bookingId: string,
  assignments: BookingRoomAssignment[],
): Promise<boolean> {
  await ensureSchema(db);
  const result = await db.prepare(
    `INSERT INTO booking_room_assignments (booking_id, assignments)
     SELECT ?, ? WHERE EXISTS (SELECT 1 FROM bookings WHERE id = ?)
     ON CONFLICT (booking_id) DO UPDATE SET assignments = excluded.assignments`,
  ).bind(bookingId, JSON.stringify(assignments), bookingId).run();
  return (result.meta.changes ?? 0) > 0;
}

export async function transferBookingRoomType(
  db: D1Database,
  input: Parameters<BookingStore['transferBookingRoomType']>[0],
): Promise<boolean> {
  await ensureSchema(db);
  const movedNights = Object.values(input.oldNightsByType).flat();
  if (movedNights.length === 0) return false;
  const guard = crypto.randomUUID();
  const statements = [
    db.prepare(
      `UPDATE bookings SET room_type_id = ?, rate_plan_id = ?, total = ?
       WHERE id = ? AND room_type_id = ? AND total = ? AND status = 'confirmed' AND check_out = ?
       AND (NOT EXISTS (SELECT 1 FROM booking_room_assignments WHERE booking_id = bookings.id)
         OR EXISTS (SELECT 1 FROM booking_room_assignments a, json_each(a.assignments) period
           WHERE a.booking_id = bookings.id
             AND json_extract(period.value, '$.roomNumber') = ?
             AND json_extract(period.value, '$.fromDate') <= ?
             AND json_extract(period.value, '$.toDate') > ?
             AND COALESCE(json_extract(period.value, '$.roomTypeId'), bookings.room_type_id) = ?))
       AND NOT EXISTS (
         SELECT 1 FROM json_each(?) nights
         LEFT JOIN inventory_holds h ON h.room_type_id = ? AND h.date = nights.value
         WHERE COALESCE(h.held, 0) >= ?
       )
       AND NOT EXISTS (
         SELECT 1 FROM json_each(?) nights, bookings occupied
         LEFT JOIN booking_units u ON u.booking_id = occupied.id
         LEFT JOIN booking_room_assignments a ON a.booking_id = occupied.id
         WHERE occupied.id <> ? AND occupied.hotel_id = bookings.hotel_id AND occupied.status = 'confirmed'
           AND ((a.assignments IS NOT NULL AND EXISTS (
             SELECT 1 FROM json_each(a.assignments) period
             WHERE json_extract(period.value, '$.roomNumber') = ?
               AND json_extract(period.value, '$.fromDate') < ?
               AND json_extract(period.value, '$.toDate') > ?
           )) OR (a.assignments IS NULL AND u.unit_number = ?
             AND occupied.check_in < ? AND occupied.check_out > ?))
       )`,
    ).bind(
      input.targetRoomTypeId, input.targetRatePlanId, input.newTotal,
      input.bookingId, input.expectedRoomTypeId, input.expectedTotal, input.checkOut,
      input.sourceRoomNumber, input.fromDate, input.fromDate, input.sourceRoomTypeId,
      JSON.stringify(movedNights), input.targetRoomTypeId, input.capacity,
      input.bookingId, input.targetRoomNumber, input.checkOut, input.fromDate,
      input.targetRoomNumber, input.checkOut, input.fromDate,
    ),
    db.prepare('INSERT INTO booking_mutation_guards (id) SELECT ? WHERE changes() > 0').bind(guard),
  ];
  for (const [typeId, nights] of Object.entries(input.oldNightsByType)) {
    statements.push(db.prepare(
      `UPDATE inventory_holds SET held = MAX(held - 1, 0)
       WHERE room_type_id = ? AND date IN (SELECT value FROM json_each(?))
         AND EXISTS (SELECT 1 FROM booking_mutation_guards WHERE id = ?)`,
    ).bind(typeId, JSON.stringify(nights), guard));
  }
  statements.push(
    db.prepare(
      `INSERT INTO inventory_holds (room_type_id, date, held)
       SELECT ?, value, 1 FROM json_each(?)
       WHERE EXISTS (SELECT 1 FROM booking_mutation_guards WHERE id = ?)
       ON CONFLICT (room_type_id, date) DO UPDATE SET held = held + 1`,
    ).bind(input.targetRoomTypeId, JSON.stringify(movedNights), guard),
    db.prepare(
      `INSERT INTO booking_units (booking_id, unit_number)
       SELECT ?, ? WHERE EXISTS (SELECT 1 FROM booking_mutation_guards WHERE id = ?)
       ON CONFLICT (booking_id) DO UPDATE SET unit_number = excluded.unit_number`,
    ).bind(input.bookingId, input.targetRoomNumber, guard),
    db.prepare(
      `INSERT INTO booking_room_assignments (booking_id, assignments)
       SELECT ?, ? WHERE EXISTS (SELECT 1 FROM booking_mutation_guards WHERE id = ?)
       ON CONFLICT (booking_id) DO UPDATE SET assignments = excluded.assignments`,
    ).bind(input.bookingId, JSON.stringify(input.assignments), guard),
  );
  const result = await db.batch(statements);
  return (result[0]?.meta.changes ?? 0) > 0;
}

export async function changeBookingStayDates(
  db: D1Database,
  input: Parameters<BookingStore['changeBookingStayDates']>[0],
): Promise<boolean> {
  await ensureSchema(db);
  if (input.addedNights.length === 0 && input.releasedNights.length === 0) return false;
  const guard = crypto.randomUUID();
  const statements = [
    db.prepare(
      `UPDATE bookings SET check_in = ?, check_out = ?, total = ?
       WHERE id = ? AND status = 'confirmed' AND room_type_id = ? AND check_in = ? AND check_out = ? AND total = ?
       AND NOT EXISTS (
         SELECT 1 FROM json_each(?) nights
         LEFT JOIN inventory_holds h ON h.room_type_id = ? AND h.date = nights.value
         WHERE COALESCE(h.held, 0) >= ?
       )
       AND NOT EXISTS (
         SELECT 1 FROM json_each(?) nights
         JOIN bookings occupied ON occupied.id <> ?
         LEFT JOIN booking_units u ON u.booking_id = occupied.id
         LEFT JOIN booking_room_assignments a ON a.booking_id = occupied.id
         WHERE occupied.hotel_id = bookings.hotel_id AND occupied.status = 'confirmed'
           AND ((a.assignments IS NOT NULL AND EXISTS (
             SELECT 1 FROM json_each(a.assignments) period
             WHERE json_extract(period.value, '$.roomNumber') = ?
               AND json_extract(period.value, '$.fromDate') <= nights.value
               AND json_extract(period.value, '$.toDate') > nights.value
           )) OR (a.assignments IS NULL AND u.unit_number = ?
             AND occupied.check_in <= nights.value AND occupied.check_out > nights.value))
       )`,
    ).bind(
      input.newCheckIn, input.newCheckOut, input.newTotal, input.bookingId, input.roomTypeId, input.expectedCheckIn, input.expectedCheckOut, input.expectedTotal,
      JSON.stringify(input.addedNights), input.roomTypeId, input.capacity,
      JSON.stringify(input.addedNights), input.bookingId, input.roomNumber, input.roomNumber,
    ),
    db.prepare('INSERT INTO booking_mutation_guards (id) SELECT ? WHERE changes() > 0').bind(guard),
    db.prepare(
      `INSERT INTO inventory_holds (room_type_id, date, held)
       SELECT ?, value, 1 FROM json_each(?)
       WHERE EXISTS (SELECT 1 FROM booking_mutation_guards WHERE id = ?)
       ON CONFLICT (room_type_id, date) DO UPDATE SET held = held + 1`,
    ).bind(input.roomTypeId, JSON.stringify(input.addedNights), guard),
    db.prepare(
      `INSERT INTO booking_units (booking_id, unit_number)
       SELECT ?, ? WHERE EXISTS (SELECT 1 FROM booking_mutation_guards WHERE id = ?)
       ON CONFLICT (booking_id) DO UPDATE SET unit_number = excluded.unit_number`,
    ).bind(input.bookingId, input.roomNumber, guard),
    db.prepare(
      `INSERT INTO booking_room_assignments (booking_id, assignments)
       SELECT ?, ? WHERE EXISTS (SELECT 1 FROM booking_mutation_guards WHERE id = ?)
       ON CONFLICT (booking_id) DO UPDATE SET assignments = excluded.assignments`,
    ).bind(input.bookingId, JSON.stringify(input.assignments), guard),
  ];
  if (input.releasedNights.length > 0) {
    statements.push(...input.releasedNights.map((night) => db.prepare(
      `UPDATE inventory_holds SET held = MAX(held - 1, 0) WHERE room_type_id = ? AND date = ?
       AND EXISTS (SELECT 1 FROM booking_mutation_guards WHERE id = ?)`
    ).bind(input.roomTypeId, night, guard)));
  }
  const result = await db.batch(statements);
  return (result[0]?.meta.changes ?? 0) > 0;
}

export async function findBookingByIdempotencyKey(
  db: D1Database,
  key: string,
): Promise<Booking | null> {
  await ensureSchema(db);
  const row = await db
    .prepare(`${BOOKING_SELECT} WHERE b.idempotency_key = ?`)
    .bind(key)
    .first<BookingRow>();
  return row ? rowToBooking(row) : null;
}

export async function getBookingByReference(
  db: D1Database,
  reference: string,
): Promise<Booking | null> {
  await ensureSchema(db);
  const row = await db
    .prepare(`${BOOKING_SELECT} WHERE b.reference = ?`)
    .bind(reference)
    .first<BookingRow>();
  return row ? rowToBooking(row) : null;
}

/**
 * Cancels a booking and credits back the nights it was holding.
 *
 * The update writes a unique guard only when this request changed the row.
 * Every held room type's credit checks that guard in the same D1 batch.
 * `MAX(held - 1, 0)` keeps a hold row nonnegative.
 */
export async function cancelBooking(
  db: D1Database,
  reference: string,
): Promise<Booking | null> {
  await ensureSchema(db);
  const existing = await getBookingByReference(db, reference);
  if (!existing) return null;
  if (existing.status === 'cancelled') return existing;

  const nightsByType = new Map<string, string[]>();
  if (existing.status === 'confirmed') {
    for (const night of nightsInRange(existing.checkIn, existing.checkOut)) {
      const typeId = existing.roomAssignments?.find((period) => period.fromDate <= night && night < period.toDate)?.roomTypeId
        ?? existing.roomTypeId;
      nightsByType.set(typeId, [...(nightsByType.get(typeId) ?? []), night]);
    }
  }

  // The guard captures the UPDATE's changes() once, then every room type's
  // credit can check it without relying on changes() after other statements.
  const guard = crypto.randomUUID();
  const statements = [
    db
      .prepare("UPDATE bookings SET status = 'cancelled' WHERE reference = ? AND status <> 'cancelled'")
      .bind(reference),
    db.prepare('INSERT INTO booking_mutation_guards (id) SELECT ? WHERE changes() > 0').bind(guard),
  ];
  for (const [typeId, nights] of nightsByType) {
    statements.push(
      db
        .prepare(
          `UPDATE inventory_holds SET held = MAX(held - 1, 0)
           WHERE room_type_id = ? AND date IN (SELECT value FROM json_each(?))
             AND EXISTS (SELECT 1 FROM booking_mutation_guards WHERE id = ?)`,
        )
        .bind(typeId, JSON.stringify(nights), guard),
    );
  }
  await db.batch(statements);

  return { ...existing, status: 'cancelled' };
}

export async function listBookings(db: D1Database, options: { hotelId?: string; limit?: number } = {}): Promise<Booking[]> {
  await ensureSchema(db);
  const where = options.hotelId ? ' WHERE b.hotel_id = ?' : '';
  const limit = options.limit === undefined ? '' : ' LIMIT ?';
  const bindings = [...(options.hotelId ? [options.hotelId] : []), ...(options.limit === undefined ? [] : [Math.max(0, Math.floor(options.limit))])];
  const { results } = await db.prepare(`${BOOKING_SELECT}${where} ORDER BY b.created_at DESC${limit}`).bind(...bindings).all<BookingRow>();
  return results.map(rowToBooking);
}

/**
 * Inserts the booking (a no-op on a replayed idempotency key) and, only when
 * this call actually created the row, increments the per-night holds that
 * back availability and records the assigned unit — all in one batch (one
 * implicit D1 transaction), so a crash partway through can never leave a
 * confirmed-looking booking that holds no inventory. Both downstream
 * statements are gated on `WHERE EXISTS (SELECT 1 FROM bookings WHERE id =
 * ?)`, bound to *this* call's own `booking.id` — not on `changes()`, which
 * only reflects the statement immediately before it and so cannot gate two
 * separate downstream statements correctly. The EXISTS check only passes
 * when this call's own INSERT actually won: on a replay with the same
 * idempotency key but a different (fresh) `booking.id`, that id was never
 * inserted, so both downstream statements correctly no-op instead of
 * crediting inventory or attaching a unit to a booking row that doesn't
 * exist. Re-reads by idempotency key afterward so a genuinely concurrent
 * duplicate returns whichever row actually won, not necessarily this one.
 */
export async function saveBooking(db: D1Database, booking: Booking, inventoryCapacity?: number): Promise<Booking> {
  await ensureSchema(db);

  const nights = booking.status === 'confirmed' ? nightsInRange(booking.checkIn, booking.checkOut) : [];
  const roomUnitCollision = booking.unitNumber
    ? `AND NOT EXISTS (
         SELECT 1 FROM bookings occupied
         LEFT JOIN booking_units u ON u.booking_id = occupied.id
         LEFT JOIN booking_room_assignments a ON a.booking_id = occupied.id
         WHERE occupied.hotel_id = ? AND occupied.status = 'confirmed'
           AND ((a.assignments IS NOT NULL AND EXISTS (
             SELECT 1 FROM json_each(a.assignments) period
             WHERE json_extract(period.value, '$.roomNumber') = ?
               AND json_extract(period.value, '$.fromDate') < ?
               AND json_extract(period.value, '$.toDate') > ?
           )) OR (a.assignments IS NULL AND u.unit_number = ?
             AND occupied.check_in < ? AND occupied.check_out > ?))
       )`
    : '';
  const insertSelect = inventoryCapacity !== undefined && nights.length
    ? `SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${nights.map(() => `(COALESCE((SELECT held FROM inventory_holds WHERE room_type_id = ? AND date = ?), 0) < ?)`).join(' AND ')} ${roomUnitCollision}`
    : `SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? ${roomUnitCollision}`;
  const insertBindings = inventoryCapacity !== undefined && nights.length
    ? [booking.id, booking.reference, booking.idempotencyKey, booking.hotelId, booking.roomTypeId, booking.ratePlanId, booking.checkIn, booking.checkOut, booking.adults, booking.children, booking.guest.firstName, booking.guest.lastName, booking.guest.email, booking.guest.phone, JSON.stringify(booking.addOnIds), booking.total, booking.currency, booking.status, booking.createdAt, ...nights.flatMap((night) => [booking.roomTypeId, night, Math.max(0, Math.floor(inventoryCapacity))]), ...(booking.unitNumber ? [booking.hotelId, booking.unitNumber, booking.checkOut, booking.checkIn, booking.unitNumber, booking.checkOut, booking.checkIn] : [])]
    : [booking.id, booking.reference, booking.idempotencyKey, booking.hotelId, booking.roomTypeId, booking.ratePlanId, booking.checkIn, booking.checkOut, booking.adults, booking.children, booking.guest.firstName, booking.guest.lastName, booking.guest.email, booking.guest.phone, JSON.stringify(booking.addOnIds), booking.total, booking.currency, booking.status, booking.createdAt, ...(booking.unitNumber ? [booking.hotelId, booking.unitNumber, booking.checkOut, booking.checkIn, booking.unitNumber, booking.checkOut, booking.checkIn] : [])];
  const statements = [
    db
      .prepare(
        `INSERT INTO bookings (
          id, reference, idempotency_key, hotel_id, room_type_id, rate_plan_id,
          check_in, check_out, adults, children,
          guest_first_name, guest_last_name, guest_email, guest_phone,
          add_on_ids, total, currency, status, created_at
        ) ${insertSelect}
        ON CONFLICT (idempotency_key) DO NOTHING`,
      )
      .bind(...insertBindings),
  ];

  if (booking.status === 'confirmed') {
    if (nights.length > 0) {
      const placeholders = nights.map(() => '(?)').join(', ');
      statements.push(
        db
          .prepare(
            `INSERT INTO inventory_holds (room_type_id, date, held)
             SELECT ?, column1, 1 FROM (VALUES ${placeholders}) WHERE EXISTS (SELECT 1 FROM bookings WHERE id = ?)
             ON CONFLICT (room_type_id, date) DO UPDATE SET held = held + 1`,
          )
          .bind(booking.roomTypeId, ...nights, booking.id),
      );
    }
  }

  if (booking.unitNumber) {
    statements.push(
      db
        .prepare(
          `INSERT INTO booking_units (booking_id, unit_number)
           SELECT ?, ? WHERE EXISTS (SELECT 1 FROM bookings WHERE id = ?)
           ON CONFLICT (booking_id) DO NOTHING`,
        )
        .bind(booking.id, booking.unitNumber, booking.id),
    );
  }

  await db.batch(statements);

  const saved = await findBookingByIdempotencyKey(db, booking.idempotencyKey);
  if (!saved) {
    if (inventoryCapacity !== undefined) {
      const error = new Error('Room inventory changed before confirmation.');
      error.name = 'BookingInventoryConflictError';
      throw error;
    }
    throw new Error('Booking insert did not persist.');
  }
  return saved;
}

interface PaymentAttemptRow {
  id: string;
  booking_id: string;
  provider: string;
  status: string;
  amount: number;
  currency: string;
}

export async function savePaymentAttempt(
  db: D1Database,
  attempt: PaymentAttempt,
): Promise<PaymentAttempt> {
  await ensureSchema(db);
  await db
    .prepare(
      'INSERT INTO payment_attempts (id, booking_id, provider, status, amount, currency) VALUES (?,?,?,?,?,?) ON CONFLICT (id) DO NOTHING',
    )
    .bind(attempt.id, attempt.bookingId, attempt.provider, attempt.status, attempt.amount, attempt.currency)
    .run();
  return attempt;
}

export async function listPaymentAttempts(
  db: D1Database,
  bookingId: string,
): Promise<PaymentAttempt[]> {
  await ensureSchema(db);
  const { results } = await db
    .prepare('SELECT * FROM payment_attempts WHERE booking_id = ?')
    .bind(bookingId)
    .all<PaymentAttemptRow>();
  return results.map((row) =>
    paymentAttemptSchema.parse({
      id: row.id,
      bookingId: row.booking_id,
      provider: row.provider,
      status: row.status,
      amount: row.amount,
      currency: row.currency,
    }),
  );
}

export async function getRoomStatusOverride(
  db: D1Database,
  roomTypeId: string,
): Promise<RoomStatus | null> {
  await ensureSchema(db);
  const row = await db
    .prepare('SELECT status FROM room_status_overrides WHERE room_type_id = ?')
    .bind(roomTypeId)
    .first<{ status: string }>();
  return row ? roomStatusSchema.parse(row.status) : null;
}

export async function setRoomStatusOverride(
  db: D1Database,
  roomTypeId: string,
  status: RoomStatus | null,
): Promise<void> {
  await ensureSchema(db);
  if (status === null) {
    await db.prepare('DELETE FROM room_status_overrides WHERE room_type_id = ?').bind(roomTypeId).run();
    return;
  }
  await db
    .prepare(
      `INSERT INTO room_status_overrides (room_type_id, status) VALUES (?, ?)
       ON CONFLICT (room_type_id) DO UPDATE SET status = excluded.status`,
    )
    .bind(roomTypeId, status)
    .run();
}

/** `units` is the number of stored rooms of the type, counted by the caller. */
export async function getAvailability(
  db: D1Database,
  roomTypeId: string,
  units: number,
  from: string,
  to: string,
): Promise<Availability[]> {
  const nights = nightsInRange(from, to);
  if (nights.length === 0) return [];
  await ensureSchema(db);

  const [overrideRow, heldRows] = await Promise.all([
    db
      .prepare('SELECT status FROM room_status_overrides WHERE room_type_id = ?')
      .bind(roomTypeId)
      .first<{ status: string }>(),
    db
      .prepare('SELECT date, held FROM inventory_holds WHERE room_type_id = ? AND date >= ? AND date <= ?')
      .bind(roomTypeId, nights[0], nights[nights.length - 1])
      .all<{ date: string; held: number }>(),
  ]);

  const override = overrideRow ? roomStatusSchema.parse(overrideRow.status) : null;
  const held = new Map(heldRows.results.map((row) => [row.date, row.held]));

  return nights.map((date): Availability => {
    const remaining = resolveRemaining(roomTypeId, units, date, override, held.get(date) ?? 0);
    return { roomTypeId, date, remaining, status: statusForRemaining(remaining) };
  });
}

export async function reset(db: D1Database): Promise<void> {
  await ensureSchema(db);
  await db.batch([
    db.prepare('DELETE FROM bookings'),
    db.prepare('DELETE FROM payment_attempts'),
    db.prepare('DELETE FROM room_status_overrides'),
    db.prepare('DELETE FROM inventory_holds'),
    db.prepare('DELETE FROM booking_mutation_guards'),
    db.prepare('DELETE FROM booking_units'),
    db.prepare('DELETE FROM booking_room_assignments'),
    db.prepare('DELETE FROM booking_groups'),
    db.prepare('DELETE FROM booking_group_members'),
    db.prepare('DELETE FROM guest_profiles'),
  ]);
}

interface BookingGroupRow {
  id: string;
  hotel_id: string;
  name: string;
  notes: string | null;
  created_at: string;
}

function rowToBookingGroup(row: BookingGroupRow): BookingGroup {
  return bookingGroupSchema.parse({
    id: row.id,
    hotelId: row.hotel_id,
    name: row.name,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  });
}

export async function createBookingGroup(db: D1Database, group: BookingGroup): Promise<BookingGroup> {
  await ensureSchema(db);
  await db
    .prepare('INSERT INTO booking_groups (id, hotel_id, name, notes, created_at) VALUES (?,?,?,?,?)')
    .bind(group.id, group.hotelId, group.name, group.notes ?? null, group.createdAt)
    .run();
  return group;
}

export async function listBookingGroups(db: D1Database, hotelId: string): Promise<BookingGroup[]> {
  await ensureSchema(db);
  const { results } = await db
    .prepare('SELECT * FROM booking_groups WHERE hotel_id = ? ORDER BY created_at DESC')
    .bind(hotelId)
    .all<BookingGroupRow>();
  return results.map(rowToBookingGroup);
}

export async function getBookingGroup(db: D1Database, id: string): Promise<BookingGroup | null> {
  await ensureSchema(db);
  const row = await db.prepare('SELECT * FROM booking_groups WHERE id = ?').bind(id).first<BookingGroupRow>();
  return row ? rowToBookingGroup(row) : null;
}

export async function assignBookingToGroup(db: D1Database, bookingId: string, groupId: string): Promise<Booking | null> {
  await ensureSchema(db);
  await db
    .prepare(
      `INSERT INTO booking_group_members (booking_id, group_id) VALUES (?, ?)
       ON CONFLICT (booking_id) DO UPDATE SET group_id = excluded.group_id`,
    )
    .bind(bookingId, groupId)
    .run();
  const row = await db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).bind(bookingId).first<BookingRow>();
  return row ? rowToBooking(row) : null;
}

export async function removeBookingFromGroup(db: D1Database, bookingId: string): Promise<Booking | null> {
  await ensureSchema(db);
  await db.prepare('DELETE FROM booking_group_members WHERE booking_id = ?').bind(bookingId).run();
  const row = await db.prepare(`${BOOKING_SELECT} WHERE b.id = ?`).bind(bookingId).first<BookingRow>();
  return row ? rowToBooking(row) : null;
}

export async function deleteBookingGroup(db: D1Database, id: string): Promise<void> {
  await ensureSchema(db);
  await db.batch([
    db.prepare('DELETE FROM booking_group_members WHERE group_id = ?').bind(id),
    db.prepare('DELETE FROM booking_groups WHERE id = ?').bind(id),
  ]);
}

interface GuestProfileRow {
  identity_json?: string;
  id: string;
  hotel_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  created_at: string;
}

function rowToGuestProfile(row: GuestProfileRow): GuestProfile {
  return guestProfileSchema.parse({
    identity: row.identity_json ? JSON.parse(row.identity_json) : undefined,
    id: row.id,
    hotelId: row.hotel_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    createdAt: row.created_at,
  });
}

export async function createGuestProfile(db: D1Database, profile: GuestProfile): Promise<GuestProfile> {
  await ensureSchema(db);
  await db
    .prepare(
      'INSERT INTO guest_profiles (id, hotel_id, first_name, last_name, email, phone, created_at) VALUES (?,?,?,?,?,?,?)',
    )
    .bind(profile.id, profile.hotelId, profile.firstName, profile.lastName, profile.email, profile.phone, profile.createdAt)
    .run();
  return profile;
}

export async function deleteGuestProfile(db: D1Database, profileId: string, hotelId: string): Promise<void> {
  await ensureSchema(db);
  await db.batch([
    db.prepare('DELETE FROM guest_profile_identities WHERE profile_id = ? AND hotel_id = ?').bind(profileId, hotelId),
    db.prepare('DELETE FROM guest_profiles WHERE id = ? AND hotel_id = ?').bind(profileId, hotelId),
  ]);
}

export async function anonymizeGuestBookings(db: D1Database, hotelId: string, email: string): Promise<number> {
  await ensureSchema(db);
  const result = await db.prepare("UPDATE bookings SET guest_first_name = 'Deleted', guest_last_name = 'Guest', guest_email = ?, guest_phone = '0000000' WHERE hotel_id = ? AND lower(guest_email) = lower(?)").bind(`deleted+${crypto.randomUUID()}@invalid.local`, hotelId, email).run();
  return result.meta.changes ?? 0;
}

export async function listGuestProfiles(db: D1Database, hotelId: string): Promise<GuestProfile[]> {
  await ensureSchema(db);
  const { results } = await db
    .prepare('SELECT g.*, i.identity_json FROM guest_profiles g LEFT JOIN guest_profile_identities i ON i.profile_id = g.id AND i.hotel_id = g.hotel_id WHERE g.hotel_id = ? ORDER BY g.created_at DESC')
    .bind(hotelId)
    .all<GuestProfileRow>();
  return results.map(rowToGuestProfile);
}

export async function saveGuestIdentity(db: D1Database, profileId: string, hotelId: string, identity: NonNullable<GuestProfile['identity']>): Promise<void> {
  await ensureSchema(db);
  await db.batch([
    db.prepare('INSERT INTO guest_profile_identities (profile_id, hotel_id, identity_json) SELECT id, hotel_id, ? FROM guest_profiles WHERE id = ? AND hotel_id = ? ON CONFLICT (hotel_id, profile_id) DO UPDATE SET identity_json = excluded.identity_json').bind(JSON.stringify(identity), profileId, hotelId),
    db.prepare('UPDATE guest_profiles SET first_name = ?, last_name = ? WHERE id = ? AND hotel_id = ?').bind(identity.firstName, identity.lastName, profileId, hotelId),
  ]);
}
