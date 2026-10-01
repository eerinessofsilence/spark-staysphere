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
    await messaging.markRead(db, 'c1');
    expect((await messaging.getConversation(db, 'h1', 'c1'))?.unread).toBe(0);
    expect(await messaging.getConversation(db, 'other-hotel', 'c1')).toBeNull();
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
});
