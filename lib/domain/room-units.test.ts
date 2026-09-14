import { describe, expect, it } from 'vitest';
import type { RoomType } from './schemas';
import {
  allocateRoomType,
  buildRoomUnits,
  facadeOf,
  ROOM_NUMBER,
  roomNumber,
  type RoomUnit,
} from './room-units';

function roomType(overrides: Partial<RoomType> = {}): RoomType {
  return {
    id: 'room_deluxe-sea',
    hotelId: 'hotel_asteria-cove',
    slug: 'deluxe-sea-view',
    name: 'Deluxe Sea View',
    description: '',
    areaM2: 32,
    floor: 2,
    capacity: 2,
    bedType: 'king',
    view: 'sea',
    amenities: [],
    media: [],
    ...overrides,
  };
}

describe('facadeOf', () => {
  it('puts sea and pool views on the sea facade', () => {
    expect(facadeOf('sea')).toBe('sea');
    expect(facadeOf('pool')).toBe('sea');
  });

  it('puts garden and city views on the town facade', () => {
    expect(facadeOf('garden')).toBe('town');
    expect(facadeOf('city')).toBe('town');
  });
});

describe('roomNumber', () => {
  it('formats an upper floor as floor + 2-digit position', () => {
    expect(roomNumber(3, 4)).toBe('304');
    expect(roomNumber(12, 5)).toBe('1205');
  });

  it('uses G for the ground floor', () => {
    expect(roomNumber(0, 7)).toBe('G07');
  });

  it('produces numbers that match ROOM_NUMBER', () => {
    expect(roomNumber(0, 3)).toMatch(ROOM_NUMBER);
    expect(roomNumber(5, 12)).toMatch(ROOM_NUMBER);
  });
});

describe('buildRoomUnits', () => {
  it('builds one unit per room type per its seeded unit count', () => {
    // room_asteria-penthouse is seeded at 2 units in availability.ts.
    const units = buildRoomUnits([roomType({ id: 'room_asteria-penthouse', floor: 8 })]);
    expect(units).toHaveLength(2);
    expect(units.every((unit) => unit.roomTypeId === 'room_asteria-penthouse')).toBe(true);
  });

  it('gives every unit a unique, well-formed room number', () => {
    const units = buildRoomUnits([
      roomType({ id: 'room_asteria-penthouse', floor: 8 }),
      roomType({ id: 'room_pool-terrace', floor: 8, view: 'pool' }),
    ]);
    const numbers = units.map((unit) => unit.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    for (const number of numbers) expect(number).toMatch(ROOM_NUMBER);
  });

  it('is stable across calls: same inputs produce the same numbering and ranks', () => {
    const rooms = [roomType({ id: 'room_pool-terrace', floor: 3, view: 'pool' })];
    expect(buildRoomUnits(rooms)).toEqual(buildRoomUnits(rooms));
  });

  it('keeps a hidden room in the numbering so a later visible room does not reuse its numbers', () => {
    // Hidden listed first: if it were dropped before numbering, the visible
    // room behind it on the same floor would start at position 1 instead of
    // after the hidden room's units, and its numbers would silently move
    // every time the CMS hid or unhid something.
    const hidden = roomType({ id: 'room_hidden', floor: 1, hidden: true });
    const visible = roomType({ id: 'room_visible', floor: 1 });

    const withHidden = buildRoomUnits([hidden, visible]);
    const withoutHidden = buildRoomUnits([visible]);

    const visibleNumbersWithHidden = withHidden
      .filter((unit) => unit.roomTypeId === 'room_visible')
      .map((unit) => unit.number);
    const visibleNumbersAlone = withoutHidden.map((unit) => unit.number);

    expect(visibleNumbersWithHidden).not.toEqual(visibleNumbersAlone);
  });
});

function unit(number: string, roomTypeId: string, rank: number): RoomUnit {
  return { number, roomTypeId, floor: 1, facade: 'sea', rank };
}

describe('allocateRoomType', () => {
  it('places a guest-chosen room in the unit they picked', () => {
    const units = [unit('101', 'room_a', 0), unit('102', 'room_a', 1)];
    const allocation = allocateRoomType({
      units,
      bookings: [
        {
          reference: 'AC-AAA111',
          checkIn: '2026-10-01',
          checkOut: '2026-10-03',
          createdAt: '2026-09-01T00:00:00.000Z',
          unitNumber: '102',
        },
      ],
      nights: ['2026-10-01', '2026-10-02'],
      taken: {},
      closedByOverride: false,
    });

    expect(allocation.assignments.get('AC-AAA111')).toBe('102');
  });

  it('falls back to automatic allocation when the chosen room clashes with an earlier booking', () => {
    const units = [unit('101', 'room_a', 0), unit('102', 'room_a', 1)];
    const first = {
      reference: 'AC-AAA111',
      checkIn: '2026-10-01',
      checkOut: '2026-10-03',
      createdAt: '2026-09-01T00:00:00.000Z',
      unitNumber: '101',
    };
    const second = {
      // Overlaps the first booking's nights and wants the same room.
      reference: 'AC-BBB222',
      checkIn: '2026-10-02',
      checkOut: '2026-10-04',
      createdAt: '2026-09-02T00:00:00.000Z',
      unitNumber: '101',
    };
    const allocation = allocateRoomType({
      units,
      bookings: [first, second],
      nights: ['2026-10-01', '2026-10-02', '2026-10-03'],
      taken: {},
      closedByOverride: false,
    });

    expect(allocation.assignments.get('AC-AAA111')).toBe('101');
    // Bumped to the other free room instead of double-booking 101.
    expect(allocation.assignments.get('AC-BBB222')).toBe('102');
  });

  it('assigns an unpicked booking to whichever room is free for its whole stay', () => {
    const units = [unit('101', 'room_a', 0), unit('102', 'room_a', 1)];
    const allocation = allocateRoomType({
      units,
      bookings: [
        {
          reference: 'AC-CCC333',
          checkIn: '2026-10-01',
          checkOut: '2026-10-03',
          createdAt: '2026-09-01T00:00:00.000Z',
        },
      ],
      nights: ['2026-10-01', '2026-10-02'],
      taken: {},
      closedByOverride: false,
    });

    const assigned = allocation.assignments.get('AC-CCC333');
    expect(['101', '102']).toContain(assigned);
  });

  it('fills remaining simulated demand into rooms nobody actually booked', () => {
    const units = [unit('101', 'room_a', 0), unit('102', 'room_a', 1), unit('103', 'room_a', 2)];
    const allocation = allocateRoomType({
      units,
      bookings: [],
      nights: ['2026-10-01'],
      taken: { '2026-10-01': 2 },
      closedByOverride: false,
    });

    const filled = units.filter((u) => allocation.occupancy.get(u.number)!.get('2026-10-01')?.kind === 'demand');
    expect(filled).toHaveLength(2);
  });

  it('marks filler nights as closed instead of demand when an admin override is behind them', () => {
    const units = [unit('101', 'room_a', 0)];
    const allocation = allocateRoomType({
      units,
      bookings: [],
      nights: ['2026-10-01'],
      taken: { '2026-10-01': 1 },
      closedByOverride: true,
    });

    expect(allocation.occupancy.get('101')!.get('2026-10-01')).toEqual({ kind: 'closed' });
  });

  it('never fills a night that a real booking already occupies', () => {
    const units = [unit('101', 'room_a', 0)];
    const allocation = allocateRoomType({
      units,
      bookings: [
        {
          reference: 'AC-DDD444',
          checkIn: '2026-10-01',
          checkOut: '2026-10-02',
          createdAt: '2026-09-01T00:00:00.000Z',
          unitNumber: '101',
        },
      ],
      nights: ['2026-10-01'],
      taken: { '2026-10-01': 1 }, // already accounted for by the real booking
      closedByOverride: false,
    });

    expect(allocation.occupancy.get('101')!.get('2026-10-01')).toEqual({
      kind: 'booking',
      reference: 'AC-DDD444',
    });
  });
});
