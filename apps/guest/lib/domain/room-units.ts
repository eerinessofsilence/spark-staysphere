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
