import { describe, expect, it } from 'vitest';
import { ensureSchema } from './d1-schema';
import { createLibsqlD1 } from './libsql-d1';
import * as housekeeping from './housekeeping-store-d1';
import { d1MessagingStore as messaging } from './messaging-store-d1';
import * as bookings from './d1-hotel-repository';
import { bookingSchema } from '../domain/schemas';

/**
 * The D1 stand-in has to run the real `*-d1.ts` modules, dialect and all:
 * `CREATE TABLE IF NOT EXISTS` in a batch, `INSERT OR IGNORE`, `ON CONFLICT
 * … excluded`, `changes()` inside a batch, and D1's row shapes. libSQL in
 * memory is the same SQLite the stores were written against.
 */
function fresh(): D1Database {
  return createLibsqlD1(':memory:');
}

describe('libSQL as D1', () => {
  it('persists named reservation guests without exceeding booked adult or child places', async () => {
    const db = fresh();
    const booking = bookingSchema.parse({
      id: 'guest-booking', reference: 'GUEST1', idempotencyKey: 'guest-booking', hotelId: 'hotel-1',
      roomTypeId: 'room-1', ratePlanId: 'rate-1', checkIn: '2026-12-10', checkOut: '2026-12-12',
      adults: 2, children: 1, guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '123456789' },
      addOnIds: [], total: 200, currency: 'EUR', status: 'confirmed', createdAt: '2026-10-01T00:00:00.000Z',
    });
    await bookings.saveBooking(db, booking, 2);
    const guest = { id: 'guest-1', bookingId: booking.id, category: 'adult' as const, firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com', createdAt: '2026-10-02T00:00:00.000Z' };
    expect(await bookings.addBookingGuest(db, guest, 'hotel-2')).toBe(false);
    expect(await bookings.addBookingGuest(db, guest, 'hotel-1')).toBe(true);
    expect(await bookings.addBookingGuest(db, { ...guest, id: 'guest-2' }, 'hotel-1')).toBe(false);
    expect(await bookings.addBookingGuest(db, { ...guest, id: 'guest-3', category: 'child', firstName: 'Sam', email: undefined }, 'hotel-1')).toBe(true);
    expect(await bookings.listBookingGuests(db, booking.id)).toMatchObject([
      { id: 'guest-1', category: 'adult', firstName: 'Grace', email: 'grace@example.com' },
      { id: 'guest-3', category: 'child', firstName: 'Sam' },
    ]);
    await bookings.cancelBooking(db, booking.reference);
    expect(await bookings.addBookingGuest(db, { ...guest, id: 'guest-4' }, 'hotel-1')).toBe(false);
  });

  it('atomically rejects a competing last-room booking', async () => {
    const db = fresh();
    const makeBooking = (id: string) => bookingSchema.parse({
      id, reference: id.toUpperCase(), idempotencyKey: `idem-${id}`, hotelId: 'hotel-1',
      roomTypeId: 'room-1', ratePlanId: 'rate-1', checkIn: '2026-12-10', checkOut: '2026-12-12',
      adults: 1, children: 0, guest: { firstName: 'Ada', lastName: 'Lovelace', email: `${id}@example.com`, phone: '123456789' },
      addOnIds: [], total: 200, currency: 'EUR', status: 'confirmed', createdAt: '2026-10-01T00:00:00.000Z',
    });
    const outcomes = await Promise.allSettled([
      bookings.saveBooking(db, makeBooking('one'), 1),
      bookings.saveBooking(db, makeBooking('two'), 1),
    ]);
    expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((item) => item.status === 'rejected')).toHaveLength(1);
    const inventory = await db.prepare('SELECT held FROM inventory_holds WHERE room_type_id = ? ORDER BY date').bind('room-1').all<{ held: number }>();
    expect(inventory.results.map((row) => row.held)).toEqual([1, 1]);
  });

  it('atomically rejects overlapping reservations for the same physical room', async () => {
    const db = fresh();
    const makeBooking = (id: string) => bookingSchema.parse({
      id, reference: id.toUpperCase(), idempotencyKey: `unit-${id}`, hotelId: 'hotel-1',
      roomTypeId: 'room-1', ratePlanId: 'rate-1', checkIn: '2026-12-10', checkOut: '2026-12-12',
      adults: 1, children: 0, guest: { firstName: 'Ada', lastName: 'Lovelace', email: `${id}@example.com`, phone: '123456789' },
      addOnIds: [], unitNumber: '101', total: 200, currency: 'EUR', status: 'confirmed', createdAt: '2026-10-01T00:00:00.000Z',
    });
    const outcomes = await Promise.allSettled([
      bookings.saveBooking(db, makeBooking('one'), 2),
      bookings.saveBooking(db, makeBooking('two'), 2),
    ]);
    expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((item) => item.status === 'rejected')).toHaveLength(1);
  });

  it('moves only remaining nights to a new room type and releases both holds on cancellation', async () => {
    const db = fresh();
    const booking = bookingSchema.parse({
      id: 'move-one', reference: 'MOVE01', idempotencyKey: 'move-one', hotelId: 'hotel-1',
      roomTypeId: 'room-old', ratePlanId: 'rate-old', checkIn: '2026-12-10', checkOut: '2026-12-13',
      adults: 1, children: 0, guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '123456789' },
      addOnIds: [], unitNumber: '101', total: 300, currency: 'EUR', status: 'confirmed',
      createdAt: '2026-10-01T00:00:00.000Z',
    });
    await bookings.saveBooking(db, booking, 2);
    const input = {
      bookingId: booking.id, expectedRoomTypeId: booking.roomTypeId, expectedTotal: booking.total,
      sourceRoomTypeId: 'room-old', sourceRoomNumber: '101',
      targetRoomTypeId: 'room-new', targetRatePlanId: 'rate-new', targetRoomNumber: '201',
      newTotal: 380, capacity: 2, fromDate: '2026-12-11', checkOut: booking.checkOut,
      oldNightsByType: { 'room-old': ['2026-12-11', '2026-12-12'] },
      assignments: [
        { roomTypeId: 'room-old', roomNumber: '101', fromDate: '2026-12-10', toDate: '2026-12-11' },
        { roomTypeId: 'room-new', roomNumber: '201', fromDate: '2026-12-11', toDate: '2026-12-13' },
      ],
    };
    expect(await bookings.transferBookingRoomType(db, input)).toBe(true);
    expect(await bookings.transferBookingRoomType(db, input)).toBe(false);
    expect(await bookings.getBookingByReference(db, booking.reference)).toMatchObject({
      roomTypeId: 'room-new', ratePlanId: 'rate-new', unitNumber: '201', total: 380,
      roomAssignments: input.assignments,
    });
    const holds = await db.prepare('SELECT room_type_id, date, held FROM inventory_holds ORDER BY room_type_id, date').all<{ room_type_id: string; date: string; held: number }>();
    expect(holds.results.filter((row) => row.held > 0)).toEqual([
      { room_type_id: 'room-new', date: '2026-12-11', held: 1 },
      { room_type_id: 'room-new', date: '2026-12-12', held: 1 },
      { room_type_id: 'room-old', date: '2026-12-10', held: 1 },
    ]);
    await expect(bookings.saveBooking(db, bookingSchema.parse({
      ...booking, id: 'other', reference: 'OTHER1', idempotencyKey: 'other',
      checkOut: '2026-12-11', total: 100,
    }), 2)).rejects.toMatchObject({ name: 'BookingInventoryConflictError' });
    await bookings.cancelBooking(db, booking.reference);
    const afterCancel = await db.prepare('SELECT held FROM inventory_holds').all<{ held: number }>();
    expect(afterCancel.results.every((row) => row.held === 0)).toBe(true);
  });

  it('extends and shortens a confirmed stay while keeping room assignments and holds in sync', async () => {
    const db = fresh();
    const booking = bookingSchema.parse({
      id: 'dates-one', reference: 'DATES1', idempotencyKey: 'dates-one', hotelId: 'hotel-1',
      roomTypeId: 'room-1', ratePlanId: 'rate-1', checkIn: '2026-12-10', checkOut: '2026-12-12',
      adults: 1, children: 0, guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '123456789' },
      addOnIds: [], unitNumber: '101', total: 200, currency: 'EUR', status: 'confirmed',
      createdAt: '2026-10-01T00:00:00.000Z',
    });
    await bookings.saveBooking(db, booking, 2);
    const extend = {
      bookingId: booking.id, expectedCheckIn: booking.checkIn, expectedCheckOut: booking.checkOut,
      expectedTotal: booking.total, roomTypeId: booking.roomTypeId, roomNumber: '101',
      newCheckIn: '2026-12-10', newCheckOut: '2026-12-14', newTotal: 400, capacity: 2,
      addedNights: ['2026-12-12', '2026-12-13'], releasedNights: [],
      assignments: [{ roomTypeId: 'room-1', roomNumber: '101', fromDate: '2026-12-10', toDate: '2026-12-14' }],
    };
    expect(await bookings.changeBookingStayDates(db, extend)).toBe(true);
    expect(await bookings.changeBookingStayDates(db, extend)).toBe(false);
    expect(await bookings.getBookingByReference(db, booking.reference)).toMatchObject({
      checkOut: '2026-12-14', total: 400, roomAssignments: extend.assignments,
    });

    const shorten = {
      ...extend, expectedCheckOut: '2026-12-14', expectedTotal: 400,
      newCheckOut: '2026-12-11', newTotal: 100,
      addedNights: [], releasedNights: ['2026-12-11', '2026-12-12', '2026-12-13'],
      assignments: [{ roomTypeId: 'room-1', roomNumber: '101', fromDate: '2026-12-10', toDate: '2026-12-11' }],
    };
    expect(await bookings.changeBookingStayDates(db, shorten)).toBe(true);
    expect(await bookings.getBookingByReference(db, booking.reference)).toMatchObject({
      checkOut: '2026-12-11', total: 100, roomAssignments: shorten.assignments,
    });
    const holds = await db.prepare('SELECT date, held FROM inventory_holds WHERE room_type_id = ? ORDER BY date')
      .bind('room-1').all<{ date: string; held: number }>();
    expect(holds.results).toEqual([
      { date: '2026-12-10', held: 1 },
      { date: '2026-12-11', held: 0 },
      { date: '2026-12-12', held: 0 },
      { date: '2026-12-13', held: 0 },
    ]);

    const extendArrival = {
      ...shorten, expectedCheckOut: '2026-12-11', expectedTotal: 100,
      newCheckIn: '2026-12-09', newTotal: 200,
      addedNights: ['2026-12-09'], releasedNights: [],
      assignments: [{ roomTypeId: 'room-1', roomNumber: '101', fromDate: '2026-12-09', toDate: '2026-12-11' }],
    };
    expect(await bookings.changeBookingStayDates(db, extendArrival)).toBe(true);
    expect(await bookings.getBookingByReference(db, booking.reference)).toMatchObject({
      checkIn: '2026-12-09', total: 200, roomAssignments: extendArrival.assignments,
    });
  });

  it('stores edited arrival and departure times without changing booking nights or price', async () => {
    const db = fresh();
    const booking = bookingSchema.parse({
      id: 'times-one', reference: 'TIMES1', idempotencyKey: 'times-one', hotelId: 'hotel-1',
      roomTypeId: 'room-1', ratePlanId: 'rate-1', checkIn: '2026-12-10', checkOut: '2026-12-12',
      adults: 1, children: 0, guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '123456789' },
      addOnIds: [], total: 200, currency: 'EUR', status: 'confirmed', createdAt: '2026-10-01T00:00:00.000Z',
    });
    await bookings.saveBooking(db, booking, 2);
    const input = { bookingId: booking.id, expectedCheckIn: booking.checkIn, expectedCheckOut: booking.checkOut,
      expectedCheckInTime: '12:00', expectedCheckOutTime: '12:00', expectedLateCheckIn: false, expectedLateCheckOut: false,
      checkInTime: '21:30', checkOutTime: '17:00', lateCheckIn: true, lateCheckOut: true };
    expect(await bookings.changeBookingStayTimes(db, input)).toBe(true);
    expect(await bookings.changeBookingStayTimes(db, input)).toBe(false);
    expect(await bookings.getBookingByReference(db, booking.reference)).toMatchObject({
      checkIn: '2026-12-10', checkOut: '2026-12-12', total: 200, checkInTime: '21:30', checkOutTime: '17:00', lateCheckIn: true, lateCheckOut: true,
    });
  });

  it('upgrades an existing time table with the late-arrival flags', async () => {
    const db = fresh();
    await db.prepare('CREATE TABLE booking_stay_times (booking_id TEXT PRIMARY KEY, check_in_time TEXT NOT NULL, check_out_time TEXT NOT NULL)').run();
    await ensureSchema(db);
    const columns = await db.prepare('PRAGMA table_info(booking_stay_times)').all<{ name: string }>();
    expect(columns.results.map((column) => column.name)).toEqual(expect.arrayContaining(['late_check_in', 'late_check_out']));
  });

  it('round-trips refund scope, selected items, VAT, reason and comment', async () => {
    const db = fresh();
    const refund = {
      id: 'refund-1', bookingId: 'booking-1', provider: 'cash', status: 'refunded' as const,
      amount: 75, currency: 'EUR' as const, vatRate: 13, comment: 'Service unavailable',
      createdAt: '2026-10-02T10:00:00.000Z', refundScope: 'items' as const,
      refundItemIds: ['addon:spa', 'order:11475'], refundReason: 'Guest complaint',
    };
    await bookings.savePaymentAttempt(db, refund);
    expect(await bookings.listPaymentAttempts(db, 'booking-1')).toEqual([refund]);
  });

  it('bootstraps the schema and round-trips a thread through the messaging store', async () => {
    const db = fresh();
    await ensureSchema(db);
    const now = '2026-09-25T10:00:00.000Z';
    await messaging.saveConversation(db, {
      id: 'c1', hotelId: 'h1', channel: 'chat', guestName: 'Ada', guestEmail: 'ada@example.com', guestPhone: null,
      bookingReference: 'AAA111', lastMessage: '', lastMessageAt: now, unread: 0, createdAt: now,
    });
    await messaging.saveMessage(db, { id: 'm1', conversationId: 'c1', from: 'guest', author: 'Ada', body: 'Hi', sentAt: now });
    await messaging.saveMessage(db, { id: 'm1', conversationId: 'c1', from: 'guest', author: 'Ada', body: 'Hi again', sentAt: now });
    const [thread] = await messaging.listConversations(db, 'h1');
    expect(thread).toMatchObject({ id: 'c1', unread: 1, lastMessage: 'Hi' });
    expect(await messaging.listMessages(db, 'c1')).toHaveLength(1);
    await messaging.setDeliveryStatus(db, 'm1', 'demo_only');
    expect(await messaging.listMessages(db, 'c1')).toMatchObject([{ deliveryStatus: 'demo_only' }]);
    await messaging.markRead(db, 'c1');
    expect((await messaging.getConversation(db, 'h1', 'c1'))?.unread).toBe(0);
    expect(await messaging.getConversation(db, 'other-hotel', 'c1')).toBeNull();
    expect(await messaging.deleteConversation(db, 'other-hotel', 'c1')).toBe(false);
    expect(await messaging.deleteConversation(db, 'h1', 'c1')).toBe(true);
    expect(await messaging.listMessages(db, 'c1')).toEqual([]);
    expect((await db.prepare('SELECT * FROM outbound_delivery_status').all()).results).toEqual([]);
  });

  it('runs the housekeeping change batch and reads the state it derived', async () => {
    const db = fresh();
    const record = { unitId: 'unit_101', hotelId: 'hotel_asteria', status: 'clean' as const, note: 'ok', updatedAt: '2026-09-25T09:00:00.000Z' };
    await housekeeping.saveChange(db, record, {
      id: 'e1', hotelId: 'hotel_asteria', unitId: 'unit_101', roomNumber: '101', memberId: 'm1', status: 'clean', note: 'ok',
      occurredAt: '2026-09-25T09:00:00.000Z', photoData: null,
    });
    expect(await housekeeping.listRecords(db, 'hotel_asteria')).toEqual([record]);
    const events = await housekeeping.listEvents(db, 'hotel_asteria', 'unit_101');
    expect(events).toHaveLength(1);
    expect(await housekeeping.getEvent(db, 'hotel_asteria', 'e1')).toMatchObject({ roomNumber: '101' });
    // The demo assignments seed once, then leave the table alone.
    const first = await housekeeping.listAssignments(db, 'hotel_asteria');
    const second = await housekeeping.listAssignments(db, 'hotel_asteria');
    expect(second).toEqual(first);
  });

  it('reports changes() per statement, including inside a batch', async () => {
    const db = fresh();
    await db.prepare('CREATE TABLE t (id TEXT PRIMARY KEY, n INTEGER NOT NULL)').run();
    const insert = await db.prepare('INSERT INTO t (id, n) VALUES (?, ?)').bind('a', 1).run();
    expect(insert.meta.changes).toBe(1);
    const [update, guarded] = await db.batch([
      db.prepare('UPDATE t SET n = n + 1 WHERE id = ?').bind('a'),
      db.prepare('UPDATE t SET n = n + 10 WHERE changes() > 0 AND id = ?').bind('a'),
    ]);
    expect(update.meta.changes).toBe(1);
    expect(guarded.meta.changes).toBe(1);
    expect(await db.prepare('SELECT n FROM t WHERE id = ?').bind('a').first<{ n: number }>()).toEqual({ n: 12 });
    expect(await db.prepare('SELECT n FROM t WHERE id = ?').bind('a').first<number>('n')).toBe(12);
    expect(await db.prepare('SELECT n FROM t WHERE id = ?').bind('zz').first()).toBeNull();
  });

  it('commits a confirmation payment with inventory, or rolls all three back together', async () => {
    const booking = (id: string) => bookingSchema.parse({
      id, reference: id.toUpperCase(), idempotencyKey: `atomic-${id}`, hotelId: 'hotel-1',
      roomTypeId: 'room-1', ratePlanId: 'rate-1', checkIn: '2035-02-01', checkOut: '2035-02-03',
      adults: 1, children: 0, guest: { firstName: 'Ada', lastName: 'Lovelace', email: `${id}@example.com`, phone: '123456789' },
      addOnIds: [], total: 200, currency: 'EUR', status: 'confirmed', createdAt: '2035-01-01T12:00:00.000Z',
    });
    const attempt = (bookingId: string) => ({
      id: `pay_${bookingId}`, bookingId, provider: 'card', status: 'authorized' as const,
      amount: 200, currency: 'EUR' as const, createdAt: '2035-01-01T12:00:00.000Z',
    });

    const db = fresh();
    const saved = await bookings.saveBooking(db, booking('success'), 1, attempt('success'));
    expect(saved.id).toBe('success');
    expect(await bookings.listPaymentAttempts(db, 'success')).toMatchObject([{ id: 'pay_success', status: 'authorized' }]);
    expect((await db.prepare('SELECT held FROM inventory_holds WHERE room_type_id = ?').bind('room-1').all<{ held: number }>()).results)
      .toMatchObject([{ held: 1 }, { held: 1 }]);

    const failingDb = fresh();
    await ensureSchema(failingDb);
    await failingDb.prepare(`CREATE TRIGGER fail_initial_payment BEFORE INSERT ON payment_attempts
      WHEN NEW.id = 'pay_rollback' BEGIN SELECT RAISE(ABORT, 'test payment failure'); END`).run();
    await expect(bookings.saveBooking(failingDb, booking('rollback'), 1, attempt('rollback'))).rejects.toThrow();
    expect(await bookings.findBookingByIdempotencyKey(failingDb, 'atomic-rollback')).toBeNull();
    expect((await failingDb.prepare('SELECT * FROM inventory_holds').all()).results).toEqual([]);
    expect((await failingDb.prepare('SELECT * FROM payment_attempts').all()).results).toEqual([]);
  });

  it('keeps concurrent refunds within the same-currency authorized balance', async () => {
    const db = fresh();
    const booking = bookingSchema.parse({
      id: 'refund-booking', reference: 'REFUND1', idempotencyKey: 'refund-booking-key', hotelId: 'hotel-1',
      roomTypeId: 'room-1', ratePlanId: 'rate-1', checkIn: '2035-02-01', checkOut: '2035-02-03',
      adults: 1, children: 0, guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'refund@example.com', phone: '123456789' },
      addOnIds: [], total: 100, currency: 'EUR', status: 'confirmed', createdAt: '2035-01-01T12:00:00.000Z',
    });
    await bookings.saveBooking(db, booking, 1);
    await bookings.savePaymentAttempt(db, { id: 'paid-eur', bookingId: booking.id, provider: 'cash', status: 'authorized', amount: 100, currency: 'EUR' });
    await bookings.savePaymentAttempt(db, { id: 'paid-usd', bookingId: booking.id, provider: 'card', status: 'authorized', amount: 900, currency: 'USD' });
    await bookings.savePaymentAttempt(db, { id: 'pending-eur', bookingId: booking.id, provider: 'bank_transfer', status: 'demo_pending', amount: 700, currency: 'EUR' });
    const refund = (id: string) => ({ id, bookingId: booking.id, provider: 'cash', status: 'refunded' as const, amount: 70, currency: 'EUR' as const });

    const outcomes = await Promise.all([
      bookings.saveRefundWithinBalance(db, refund('refund-one')),
      bookings.saveRefundWithinBalance(db, refund('refund-two')),
    ]);
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    const savedRefunds = (await bookings.listPaymentAttempts(db, booking.id)).filter((attempt) => attempt.status === 'refunded');
    expect(savedRefunds.reduce((sum, attempt) => sum + attempt.amount, 0)).toBe(70);
    expect(await bookings.saveRefundWithinBalance(db, { ...refund('refund-too-large'), amount: 30.01 })).toBe(false);
  });
});
