import { demoHash, nightsInRange } from './availability';
import type { PhysicalRoom, RoomType } from './schemas';

export type Facade = 'sea' | 'town';

export const facades: Facade[] = ['sea', 'town'];

/** Pool rooms open onto the sea-side plinth, garden rooms onto the terrace behind. */
export function facadeOf(view: RoomType['view']): Facade {
  return view === 'sea' || view === 'pool' ? 'sea' : 'town';
}

export function roomNumber(floor: number, position: number): string {
  return `${floor === 0 ? 'G' : floor}${String(position).padStart(2, '0')}`;
}

/**
 * Room numbers in the order a hotel team reads them (G07 before 101, 2 before
 * 12), not alphabetically ('12' before '2'). Shared by the front desk, the
 * floor plan, and the CMS's renumbering rules — see `inventory-service.ts`
 * and `content-service.ts`.
 */
export function compareRoomNumbers(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true });
}

/** The floor a room number names: `305` is on the 3rd floor, `G04` on the ground floor. */
export function floorOf(number: string): number {
  return number.startsWith('G') ? 0 : Number(number.slice(0, -2));
}

export function byRoomNumber(a: { number: string }, b: { number: string }): number {
  return compareRoomNumbers(a.number, b.number);
}

/** The first free number on a floor, counting up from position 01. */
export function nextRoomNumber(floor: number, rooms: Array<Pick<PhysicalRoom, 'number'>>): string {
  const taken = new Set(rooms.map((room) => room.number));
  for (let position = 1; position < 100; position += 1) {
    const candidate = roomNumber(floor, position);
    if (!taken.has(candidate)) return candidate;
  }
  return roomNumber(floor, 99);
}

export interface RoomUnit {
  number: string;
  roomTypeId: string;
  floor: number;
  facade: Facade;
  /** Fill order when a room type is partly occupied; hashed so occupied doors scatter. */
  rank: number;
}

/**
 * Lays rooms out floor by floor, sea facade first, numbering each floor from
 * 01 — how the demo building's seed rooms were numbered. A hotel's rooms are
 * stored, not derived; this only builds the seed in `mock-data.ts`.
 */
export function layOutRooms(
  roomTypes: RoomType[],
  countFor: (roomTypeId: string) => number,
): Array<Pick<PhysicalRoom, 'number' | 'roomTypeId' | 'floor'>> {
  const byFloor = new Map<number, RoomType[]>();
  for (const type of roomTypes) byFloor.set(type.floor, [...(byFloor.get(type.floor) ?? []), type]);

  const laidOut: Array<Pick<PhysicalRoom, 'number' | 'roomTypeId' | 'floor'>> = [];
  for (const [floor, floorTypes] of [...byFloor.entries()].sort((a, b) => a[0] - b[0])) {
    const ordered = [...floorTypes].sort(
      (a, b) => facades.indexOf(facadeOf(a.view)) - facades.indexOf(facadeOf(b.view)),
    );
    let position = 0;
    for (const type of ordered) {
      for (let index = 0; index < countFor(type.id); index += 1) {
        position += 1;
        laidOut.push({ number: roomNumber(floor, position), roomTypeId: type.id, floor });
      }
    }
  }
  return laidOut;
}

/**
 * Every stored room as the allocator sees it. Pass every room type, hidden
 * ones included: a room's facade follows its type's view, and its fill rank
 * is hashed within its type so occupied doors scatter.
 */
export function buildRoomUnits(roomTypes: RoomType[], rooms: PhysicalRoom[]): RoomUnit[] {
  const units: RoomUnit[] = [];
  for (const type of roomTypes) {
    const own = rooms.filter((room) => room.roomTypeId === type.id).sort(byRoomNumber);
    const fillOrder = own
      .map((_, index) => index)
      .sort((a, b) => demoHash(`${type.id}#${a}`) - demoHash(`${type.id}#${b}`) || a - b);
    own.forEach((room, index) => {
      units.push({
        number: room.number,
        roomTypeId: type.id,
        floor: room.floor,
        facade: facadeOf(type.view),
        rank: fillOrder.indexOf(index),
      });
    });
  }
  return units;
}

export type NightOccupant =
  | { kind: 'booking'; reference: string }
  | { kind: 'demand' }
  | { kind: 'closed' };

export interface AllocatableBooking {
  reference: string;
  checkIn: string;
  checkOut: string;
  createdAt: string;
  unitNumber?: string;
}

export interface RoomTypeAllocation {
  /** unit number → night → occupant; an empty night is absent. */
  occupancy: Map<string, Map<string, NightOccupant>>;
  /** booking reference → unit number. */
  assignments: Map<string, string>;
}

/**
 * Who is in each room of one room type. Bookings that named a room get it;
 * the rest go, in booking order, to the lowest-ranked room free for their whole
 * stay. Whatever `taken` still counts each night fills the lowest-ranked free
 * rooms as simulated demand, or as closed when an admin override is behind it.
 */
export function allocateRoomType(input: {
  units: RoomUnit[];
  bookings: AllocatableBooking[];
  nights: string[];
  taken: Record<string, number>;
  closedByOverride: boolean;
}): RoomTypeAllocation {
  const byRank = [...input.units].sort((a, b) => a.rank - b.rank);
  const occupancy = new Map(byRank.map((unit) => [unit.number, new Map<string, NightOccupant>()]));
  const assignments = new Map<string, string>();

  const clashes = (number: string, nights: string[]) =>
    nights.filter((night) => occupancy.get(number)!.has(night)).length;
  const place = (reference: string, number: string, nights: string[]) => {
    const row = occupancy.get(number)!;
    for (const night of nights) if (!row.has(night)) row.set(night, { kind: 'booking', reference });
    assignments.set(reference, number);
  };

  const ordered = [...input.bookings].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.reference.localeCompare(b.reference),
  );

  for (const booking of ordered) {
    if (!booking.unitNumber || !occupancy.has(booking.unitNumber)) continue;
    const nights = nightsInRange(booking.checkIn, booking.checkOut);
    if (clashes(booking.unitNumber, nights) === 0) place(booking.reference, booking.unitNumber, nights);
  }

  for (const booking of ordered) {
    if (assignments.has(booking.reference)) continue;
    const nights = nightsInRange(booking.checkIn, booking.checkOut);
    let best: RoomUnit | undefined;
    let fewest = Number.POSITIVE_INFINITY;
    for (const unit of byRank) {
      const count = clashes(unit.number, nights);
      if (count < fewest) {
        best = unit;
        fewest = count;
      }
      if (count === 0) break;
    }
    if (best) place(booking.reference, best.number, nights);
  }

  for (const night of input.nights) {
    const booked = byRank.filter(
      (unit) => occupancy.get(unit.number)!.get(night)?.kind === 'booking',
    ).length;
    let filler = Math.max(0, (input.taken[night] ?? 0) - booked);
    for (const unit of byRank) {
      if (filler === 0) break;
      const row = occupancy.get(unit.number)!;
      if (row.has(night)) continue;
      row.set(night, input.closedByOverride ? { kind: 'closed' } : { kind: 'demand' });
      filler -= 1;
    }
  }

  return { occupancy, assignments };
}
