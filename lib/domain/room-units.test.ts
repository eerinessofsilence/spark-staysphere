import { describe, expect, it } from 'vitest';
import { ROOM_NUMBER, type PhysicalRoom, type RoomType } from './schemas';
import {
  allocateRoomType,
  buildRoomUnits,
  compareRoomNumbers,
  facadeOf,
  floorOf,
  layOutRooms,
  nextRoomNumber,
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

describe('compareRoomNumbers', () => {
  it('sorts numerically within a floor, not alphabetically', () => {
    expect(['110', '12', '2', '101'].sort(compareRoomNumbers)).toEqual(['2', '12', '101', '110']);
  });

  it('sorts G-prefixed room numbers numerically among themselves', () => {
    expect(['G10', 'G01', 'G02'].sort(compareRoomNumbers)).toEqual(['G01', 'G02', 'G10']);
  });
});

function physicalRoom(number: string, roomTypeId: string): PhysicalRoom {
  return { id: `unit_${number}`, hotelId: 'hotel_asteria-cove', roomTypeId, number, floor: floorOf(number) };
}

describe('floorOf', () => {
  it('reads the floor off a room number', () => {
    expect(floorOf('305')).toBe(3);
    expect(floorOf('1205')).toBe(12);
    expect(floorOf('G04')).toBe(0);
  });
});

describe('nextRoomNumber', () => {
  it('starts a floor at position 01 and skips numbers already taken', () => {
    expect(nextRoomNumber(4, [])).toBe('401');
    expect(nextRoomNumber(4, [{ number: '401' }, { number: '402' }, { number: '404' }])).toBe('403');
    expect(nextRoomNumber(0, [{ number: 'G01' }])).toBe('G02');
  });
});

describe('layOutRooms', () => {
  it('numbers each floor from 01, sea facade first', () => {
    const laidOut = layOutRooms(
      [roomType({ id: 'room_town', floor: 2, view: 'city' }), roomType({ id: 'room_sea', floor: 2, view: 'sea' })],
      () => 2,
    );
    expect(laidOut.map((room) => `${room.number}:${room.roomTypeId}`)).toEqual([
      '201:room_sea',
      '202:room_sea',
      '203:room_town',
      '204:room_town',
    ]);
    for (const room of laidOut) expect(room.number).toMatch(ROOM_NUMBER);
  });
});

describe('buildRoomUnits', () => {
  it('builds one unit per stored room, keeping its number and floor', () => {
    const type = roomType({ id: 'room_asteria-penthouse', floor: 8 });
    const units = buildRoomUnits([type], [physicalRoom('802', type.id), physicalRoom('801', type.id)]);
    expect(units.map((unit) => unit.number)).toEqual(['801', '802']);
    expect(units.every((unit) => unit.floor === 8 && unit.roomTypeId === type.id)).toBe(true);
  });

  it("takes each room's facade from its type's view", () => {
    const units = buildRoomUnits(
      [roomType({ id: 'room_pool', view: 'pool' }), roomType({ id: 'room_garden', view: 'garden' })],
      [physicalRoom('201', 'room_pool'), physicalRoom('202', 'room_garden')],
    );
    expect(units.find((unit) => unit.number === '201')?.facade).toBe('sea');
    expect(units.find((unit) => unit.number === '202')?.facade).toBe('town');
  });

  it('gives every room of a type a distinct fill rank, stable across calls', () => {
    const types = [roomType({ id: 'room_pool-terrace', floor: 3, view: 'pool' })];
    const rooms = ['301', '302', '303'].map((number) => physicalRoom(number, 'room_pool-terrace'));
    const units = buildRoomUnits(types, rooms);
    expect(new Set(units.map((unit) => unit.rank))).toEqual(new Set([0, 1, 2]));
    expect(buildRoomUnits(types, rooms)).toEqual(units);
  });

  it('includes rooms of a hidden type and ignores rooms whose type is not passed', () => {
    const hidden = roomType({ id: 'room_hidden', hidden: true });
    const units = buildRoomUnits([hidden], [physicalRoom('101', 'room_hidden'), physicalRoom('102', 'room_gone')]);
    expect(units.map((unit) => unit.number)).toEqual(['101']);
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
