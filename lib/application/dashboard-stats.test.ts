import { describe, expect, it } from 'vitest';
import { bookingSchema, type Booking } from '../domain/schemas';
import { mealsByDay, nextArrivals, nextDepartures, reservationBuckets, revenueKpis, roomTypeAvailability, todayMovements } from './dashboard-stats';
import type { FrontDesk } from './inventory-service';

const TODAY = '2026-09-24';

function booking(overrides: Partial<Booking> & { checkIn: string; checkOut: string }): Booking {
  return bookingSchema.parse({
    id: `bkg_${overrides.checkIn}_${overrides.checkOut}_${overrides.reference ?? 'X'}`,
    reference: 'ABC123',
    idempotencyKey: `key_${Math.random()}`,
    hotelId: 'hotel_asteria',
    roomTypeId: 'room_deluxe-sea',
    ratePlanId: 'rate_flex',
    adults: 2,
    children: 0,
    guest: { firstName: 'Ada', lastName: 'Lindqvist', email: 'ada@example.com', phone: '+357 99 000 000' },
    addOnIds: [],
    total: 300,
    currency: 'EUR',
    status: 'confirmed',
    stayState: 'booked',
    createdAt: '2026-09-20T10:00:00.000Z',
    ...overrides,
  });
}

describe('reservationBuckets', () => {
  it('puts every booking in exactly one operational bucket', () => {
    const bookings = [
      booking({ checkIn: '2026-09-30', checkOut: '2026-10-02' }),
      booking({ checkIn: TODAY, checkOut: '2026-09-26' }),
      booking({ checkIn: '2026-09-22', checkOut: '2026-09-26', stayState: 'checked_in' }),
      booking({ checkIn: '2026-09-22', checkOut: TODAY }),
      booking({ checkIn: '2026-09-10', checkOut: '2026-09-12' }),
      booking({ checkIn: '2026-09-22', checkOut: '2026-09-26', stayState: 'checked_out' }),
      booking({ checkIn: '2026-09-30', checkOut: '2026-10-02', status: 'cancelled' }),
      booking({ checkIn: '2026-09-22', checkOut: '2026-09-26', stayState: 'no_show' }),
      booking({ checkIn: '2026-09-30', checkOut: '2026-10-02', status: 'held' }),
    ];
    const buckets = reservationBuckets(bookings, TODAY);
    expect(buckets).toEqual({ upcoming: 1, dueIn: 1, inHouse: 1, dueOut: 1, completed: 2, other: 3 });
    expect(Object.values(buckets).reduce((sum, count) => sum + count, 0)).toBe(bookings.length);
  });
});

describe('todayMovements', () => {
  it('lists arrivals, departures and everyone sleeping here tonight, with the head count', () => {
    const arriving = booking({ checkIn: TODAY, checkOut: '2026-09-26', adults: 2, children: 1 });
    const leaving = booking({ checkIn: '2026-09-22', checkOut: TODAY });
    const staying = booking({ checkIn: '2026-09-22', checkOut: '2026-09-27', adults: 1 });
    const gone = booking({ checkIn: '2026-09-22', checkOut: '2026-09-27', stayState: 'checked_out' });
    const noShow = booking({ checkIn: TODAY, checkOut: '2026-09-26', stayState: 'no_show' });
    const moves = todayMovements([arriving, leaving, staying, gone, noShow], TODAY);
    expect(moves.arrivals).toEqual([arriving]);
    expect(moves.departures).toEqual([leaving]);
    expect(moves.inHouse).toEqual([arriving, staying]);
    expect(moves.adults).toBe(3);
    expect(moves.children).toBe(1);
  });
});

describe('nextArrivals / nextDepartures', () => {
  it('lists the soonest future arrivals and the soonest departures of the guests in house', () => {
    const later = booking({ checkIn: '2026-09-28', checkOut: '2026-09-30', reference: 'LATER' });
    const soon = booking({ checkIn: '2026-09-25', checkOut: '2026-09-27', reference: 'SOON' });
    const today = booking({ checkIn: TODAY, checkOut: '2026-09-29', reference: 'TODAY' });
    const cancelled = booking({ checkIn: '2026-09-25', checkOut: '2026-09-27', status: 'cancelled' });
    const staying = booking({ checkIn: '2026-09-22', checkOut: '2026-09-26', reference: 'STAY' });
    const all = [later, soon, today, cancelled, staying];
    expect(nextArrivals(all, TODAY, 5).map((b) => b.reference)).toEqual(['SOON', 'LATER']);
    expect(nextArrivals(all, TODAY, 1).map((b) => b.reference)).toEqual(['SOON']);
    expect(nextDepartures(all, TODAY, 5).map((b) => b.reference)).toEqual(['STAY', 'TODAY']);
  });
});

describe('roomTypeAvailability', () => {
  it('counts tonight as sold for booking and simulated demand, but not a closed room', () => {
    const board = {
      groups: [
        {
          roomTypeId: 'room_a',
          roomName: 'A',
          hidden: false,
          rooms: [
            { number: '101', segments: [{ kind: 'booking', start: 0, span: 2 }] },
            { number: '102', segments: [{ kind: 'demand', start: -1, span: 3 }] },
            { number: '103', segments: [{ kind: 'closed', start: 0, span: 14 }] },
            { number: '104', segments: [{ kind: 'booking', start: 1, span: 2 }] },
          ],
        },
        { roomTypeId: 'room_hidden', roomName: 'Hidden', hidden: true, rooms: [] },
      ],
    } as unknown as FrontDesk;
    expect(roomTypeAvailability(board, new Map([['room_a', 'last_room']]))).toEqual([
      { roomTypeId: 'room_a', name: 'A', total: 4, sold: 2, available: 2, status: 'last_room' },
    ]);
  });
});

describe('mealsByDay', () => {
  it('counts breakfast covers from breakfast-inclusive rates and dining add-ons of the guests in house', () => {
    const ratePlans = [{ id: 'rate_bb', breakfastIncluded: true }, { id: 'rate_ro', breakfastIncluded: false }] as never;
    const addOns = [{ id: 'addon_dinner', category: 'dining' }, { id: 'addon_spa', category: 'service' }] as never;
    const bookings = [
      booking({ checkIn: TODAY, checkOut: '2026-09-26', ratePlanId: 'rate_bb', adults: 2, children: 1, addOnIds: ['addon_dinner', 'addon_spa'] }),
      booking({ checkIn: TODAY, checkOut: '2026-09-25', ratePlanId: 'rate_ro', adults: 2, addOnIds: ['addon_dinner'] }),
    ];
    expect(mealsByDay(bookings, ratePlans, addOns, [TODAY, '2026-09-25', '2026-09-26'])).toEqual([
      { date: TODAY, breakfast: 3, dining: 2 },
      { date: '2026-09-25', breakfast: 3, dining: 1 },
      { date: '2026-09-26', breakfast: 0, dining: 0 },
    ]);
  });
});

describe('revenueKpis', () => {
  it('spreads each stay evenly over its nights and derives RevPAR and ADR from the night', () => {
    const bookings = [
      booking({ checkIn: '2026-09-23', checkOut: '2026-09-26', total: 300, createdAt: `${TODAY}T09:00:00.000Z` }),
      booking({ checkIn: TODAY, checkOut: '2026-09-25', total: 150, createdAt: `${TODAY}T11:00:00.000Z` }),
      booking({ checkIn: '2026-09-30', checkOut: '2026-10-01', total: 999, createdAt: `${TODAY}T12:00:00.000Z` }),
    ];
    const kpis = revenueKpis(bookings, 10, TODAY);
    expect(kpis.roomRevenue).toBe(250);
    expect(kpis.occupiedRooms).toBe(2);
    expect(kpis.revpar).toBe(25);
    expect(kpis.adr).toBe(125);
    expect(kpis.orders).toBe(3);
  });

  it('is zero on an empty night rather than dividing by nothing', () => {
    expect(revenueKpis([], 0, TODAY)).toEqual({ roomRevenue: 0, occupiedRooms: 0, revpar: 0, adr: 0, orders: 0 });
  });
});
