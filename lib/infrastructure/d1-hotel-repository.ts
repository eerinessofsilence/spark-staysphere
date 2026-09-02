import {
  addOnSchema,
  bookingSchema,
  paymentAttemptSchema,
  roomStatusSchema,
  type AddOn,
  type Availability,
  type Booking,
  type PaymentAttempt,
  type RoomStatus,
} from '../domain/schemas';
import { nightsInRange, resolveRemaining, statusForRemaining } from '../domain/availability';
import { ensureSchema } from './d1-schema';
import { demoAddOns, demoHotel } from './mock-data';

/**
 * D1-backed reads and writes for the durable slice of demo state: bookings,
 * payment attempts, admin overrides, and confirmed-booking holds. The
 * room/rate/add-on catalog stays static seed data (mock-data.ts) in every
 * backend — only what a guest or the admin panel actually mutates lives here.
 * Every function is a plain (db, ...args) call, dispatched to by
 * durable-hotel-repository.ts; nothing here decides whether D1 is in use.
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
}

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
      phone: row.guest_phone,
    },
    addOnIds: JSON.parse(row.add_on_ids) as string[],
    total: row.total,
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
  });
}

export async function findBookingByIdempotencyKey(
  db: D1Database,
  key: string,
): Promise<Booking | null> {
  await ensureSchema(db);
  const row = await db
    .prepare('SELECT * FROM bookings WHERE idempotency_key = ?')
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
    .prepare('SELECT * FROM bookings WHERE reference = ?')
    .bind(reference)
    .first<BookingRow>();
  return row ? rowToBooking(row) : null;
}

export async function listBookings(db: D1Database): Promise<Booking[]> {
  await ensureSchema(db);
  const { results } = await db
    .prepare('SELECT * FROM bookings ORDER BY created_at DESC')
    .all<BookingRow>();
  return results.map(rowToBooking);
}

/**
 * Inserts the booking (a no-op on a replayed idempotency key) and, only when
 * this call actually created the row, increments the per-night holds that
 * back availability. Re-reads by idempotency key afterward so a genuinely
 * concurrent duplicate returns whichever row actually won, not this one.
 */
export async function saveBooking(db: D1Database, booking: Booking): Promise<Booking> {
  await ensureSchema(db);

  const insertResult = await db
    .prepare(
      `INSERT INTO bookings (
        id, reference, idempotency_key, hotel_id, room_type_id, rate_plan_id,
        check_in, check_out, adults, children,
        guest_first_name, guest_last_name, guest_email, guest_phone,
        add_on_ids, total, currency, status, created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT (idempotency_key) DO NOTHING`,
    )
    .bind(
      booking.id,
      booking.reference,
      booking.idempotencyKey,
      booking.hotelId,
      booking.roomTypeId,
      booking.ratePlanId,
      booking.checkIn,
      booking.checkOut,
      booking.adults,
      booking.children,
      booking.guest.firstName,
      booking.guest.lastName,
      booking.guest.email,
      booking.guest.phone,
      JSON.stringify(booking.addOnIds),
      booking.total,
      booking.currency,
      booking.status,
      booking.createdAt,
    )
    .run();

  const inserted = (insertResult.meta.changes ?? 0) > 0;
  if (inserted && booking.status === 'confirmed') {
    const nights = nightsInRange(booking.checkIn, booking.checkOut);
    if (nights.length > 0) {
      await db.batch(
        nights.map((date) =>
          db
            .prepare(
              `INSERT INTO inventory_holds (room_type_id, date, held) VALUES (?, ?, 1)
               ON CONFLICT (room_type_id, date) DO UPDATE SET held = held + 1`,
            )
            .bind(booking.roomTypeId, date),
        ),
      );
    }
  }

  const saved = await findBookingByIdempotencyKey(db, booking.idempotencyKey);
  if (!saved) throw new Error('Booking insert did not persist.');
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
      'INSERT INTO payment_attempts (id, booking_id, provider, status, amount, currency) VALUES (?,?,?,?,?,?)',
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

export async function setAddOnEnabled(
  db: D1Database,
  addOnId: string,
  enabled: boolean,
): Promise<void> {
  await ensureSchema(db);
  await db
    .prepare(
      `INSERT INTO addon_toggles (addon_id, enabled) VALUES (?, ?)
       ON CONFLICT (addon_id) DO UPDATE SET enabled = excluded.enabled`,
    )
    .bind(addOnId, enabled ? 1 : 0)
    .run();
}

export async function listAddOns(db: D1Database, hotelId: string): Promise<AddOn[]> {
  if (hotelId !== demoHotel.id) return [];
  await ensureSchema(db);
  const { results } = await db
    .prepare('SELECT addon_id, enabled FROM addon_toggles')
    .all<{ addon_id: string; enabled: number }>();
  const overrides = new Map(results.map((row) => [row.addon_id, row.enabled === 1]));
  return demoAddOns.map((addOn) =>
    addOnSchema.parse({ ...addOn, enabled: overrides.get(addOn.id) ?? addOn.enabled }),
  );
}

export async function getAvailability(
  db: D1Database,
  roomTypeId: string,
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
    const remaining = resolveRemaining(roomTypeId, date, override, held.get(date) ?? 0);
    return { roomTypeId, date, remaining, status: statusForRemaining(remaining) };
  });
}

export async function reset(db: D1Database): Promise<void> {
  await ensureSchema(db);
  await db.batch([
    db.prepare('DELETE FROM bookings'),
    db.prepare('DELETE FROM payment_attempts'),
    db.prepare('DELETE FROM room_status_overrides'),
    db.prepare('DELETE FROM addon_toggles'),
    db.prepare('DELETE FROM inventory_holds'),
  ]);
}

