import { demoHash, nightsInRange, unitsFor } from './availability';
import type { RoomType } from './schemas';

export type Facade = 'sea' | 'town';

export const facades: Facade[] = ['sea', 'town'];

/** Pool rooms open onto the sea-side plinth, garden rooms onto the terrace behind. */
export function facadeOf(view: RoomType['view']): Facade {
  return view === 'sea' || view === 'pool' ? 'sea' : 'town';
}

export const ROOM_NUMBER = /^(?:G|[1-9]\d?)\d{2}$/;

export function roomNumber(floor: number, position: number): string {
  return `${floor === 0 ? 'G' : floor}${String(position).padStart(2, '0')}`;
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
 * Every physical room, derived from the same unit counts availability sells.
 * Always build from all room types, hidden ones included, so numbers stay stable.
 */
export function buildRoomUnits(rooms: RoomType[]): RoomUnit[] {
  const byFloor = new Map<number, RoomType[]>();
  for (const room of rooms) byFloor.set(room.floor, [...(byFloor.get(room.floor) ?? []), room]);

  const units: RoomUnit[] = [];
  for (const [floor, floorRooms] of [...byFloor.entries()].sort((a, b) => a[0] - b[0])) {
    const ordered = [...floorRooms].sort(
      (a, b) => facades.indexOf(facadeOf(a.view)) - facades.indexOf(facadeOf(b.view)),
    );
    let position = 0;
    for (const room of ordered) {
      const count = unitsFor(room.id);
      const fillOrder = Array.from({ length: count }, (_, index) => index).sort(
        (a, b) => demoHash(`${room.id}#${a}`) - demoHash(`${room.id}#${b}`) || a - b,
      );
      for (let index = 0; index < count; index += 1) {
        position += 1;
        units.push({
          number: roomNumber(floor, position),
          roomTypeId: room.id,
          floor,
          facade: facadeOf(room.view),
          rank: fillOrder.indexOf(index),
        });
      }
    }
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
