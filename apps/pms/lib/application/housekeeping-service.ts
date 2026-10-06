import { addIsoDays } from '../domain/dates';
import { defaultHousekeepingStatus, type RoomOccupancy } from '../domain/housekeeping';
import { validateHousekeepingChange } from '../domain/housekeeping-change';
import type { CatalogReader, Clock, HousekeepingEvent, HousekeepingStore } from '../domain/ports';
import { byRoomNumber, facadeOf, type Facade } from '../domain/room-units';
import type { HousekeepingStatus, PhysicalRoom } from '../domain/schemas';
import type { CatalogService } from './catalog-service';
import type { FrontDeskRoom, FrontDeskSegment, InventoryService } from './inventory-service';

/** One row of the housekeeping board: the door, where it stands, and who is (or was) behind it today. */
export interface HousekeepingRoom {
  unit: PhysicalRoom;
  roomTypeName: string;
  facade: Facade;
  status: HousekeepingStatus;
  note: string | null;
  /** When someone last set the status — `null` while the room still shows its default. */
  updatedAt: string | null;
  occupancy: RoomOccupancy;
  /** Tonight's guest, or this morning's departure — `null` for a vacant room. */
  guest: { name: string; checkIn: string; checkOut: string; reference: string | null } | null;
}

export type SetHousekeepingStatusResult =
  | { ok: true; room: HousekeepingRoom }
  | { ok: false; error: 'roomNotFound' | 'invalidStatus' | 'notAssigned' | 'photoRequired' | 'invalidPhoto' };

const NOTE_MAX = 200;

function segmentAt(room: FrontDeskRoom, index: number): FrontDeskSegment | null {
  return room.segments.find((segment) => segment.start <= index && index < segment.start + segment.span) ?? null;
}

/**
 * Housekeeping's board over the same rooms the front desk draws: every
 * physical room of the selected hotel, its occupancy read off the desk's
 * own allocation (last night and tonight, so a departure and an arrival
 * each read as what they are), and its status from the store — or, for a
 * room nobody has marked yet, the default `lib/domain/housekeeping.ts`
 * derives from that occupancy.
 */
export class HousekeepingService {
  constructor(
    private readonly store: HousekeepingStore,
    private readonly repository: Pick<CatalogReader, 'listRooms' | 'listPhysicalRooms'>,
    private readonly catalog: Pick<CatalogService, 'getHotel'>,
    private readonly inventory: Pick<InventoryService, 'getFrontDesk'>,
    private readonly clock: Clock,
  ) {}

  async listRooms(hotelSlug: string, today: string): Promise<HousekeepingRoom[]> {
    const hotel = await this.catalog.getHotel(hotelSlug);
    const [roomTypes, units, records, board] = await Promise.all([
      this.repository.listRooms(hotel.id),
      this.repository.listPhysicalRooms(hotel.id),
      this.store.listRecords(hotel.id),
      this.inventory.getFrontDesk(hotelSlug, addIsoDays(today, -1), 2),
    ]);
    const types = new Map(roomTypes.map((type) => [type.id, type]));
    const recordByUnit = new Map(records.map((record) => [record.unitId, record]));
    const boardByNumber = new Map(board.groups.flatMap((group) => group.rooms.map((room) => [room.number, room])));

    return units
      .filter((unit) => types.has(unit.roomTypeId))
      .sort(byRoomNumber)
      .map((unit) => {
        const type = types.get(unit.roomTypeId)!;
        const desk = boardByNumber.get(unit.number);
        const lastNight = desk ? segmentAt(desk, 0) : null;
        const tonight = desk ? segmentAt(desk, 1) : null;
        const stay = tonight && tonight.kind !== 'closed' ? tonight : null;
        const departed = !stay && lastNight && lastNight.kind !== 'closed' ? lastNight : null;
        const occupancy: RoomOccupancy = stay
          ? stay.checkIn === today
            ? 'arriving'
            : 'occupied'
          : departed
            ? 'departing'
            : 'vacant';
        const current = stay ?? departed;
        const record = recordByUnit.get(unit.id);
        return {
          unit,
          roomTypeName: type.name,
          facade: facadeOf(type.view),
          status: record?.status ?? defaultHousekeepingStatus(unit.id, occupancy),
          note: record?.note ?? null,
          updatedAt: record?.updatedAt ?? null,
          occupancy,
          guest: current
            ? {
                name: current.guestName,
                checkIn: current.checkIn,
                checkOut: current.checkOut,
                reference: current.kind === 'booking' ? current.reference : null,
              }
            : null,
        };
      });
  }

  async getRoom(hotelSlug: string, unitId: string, today: string): Promise<HousekeepingRoom | null> {
    return (await this.listRooms(hotelSlug, today)).find((room) => room.unit.id === unitId) ?? null;
  }

  async listAssignments(hotelSlug: string) {
    const hotel = await this.catalog.getHotel(hotelSlug);
    return this.store.listAssignments(hotel.id);
  }

  async listAssignedRooms(hotelSlug: string, today: string, memberId: string): Promise<HousekeepingRoom[]> {
    const [rooms, assignments] = await Promise.all([this.listRooms(hotelSlug, today), this.listAssignments(hotelSlug)]);
    const ids = new Set(assignments.filter((assignment) => assignment.memberId === memberId).map((assignment) => assignment.unitId));
    return rooms.filter((room) => ids.has(room.unit.id));
  }

  async assignRoom(hotelSlug: string, unitId: string, memberId: string | null): Promise<boolean> {
    const hotel = await this.catalog.getHotel(hotelSlug);
    const units = await this.repository.listPhysicalRooms(hotel.id);
    if (!units.some((unit) => unit.id === unitId)) return false;
    await this.store.setAssignment({ hotelId: hotel.id, unitId, memberId });
    return true;
  }

  async listEvents(hotelSlug: string, unitId: string): Promise<HousekeepingEvent[]> {
    const hotel = await this.catalog.getHotel(hotelSlug);
    return this.store.listEvents(hotel.id, unitId);
  }

  async getEvent(hotelSlug: string, id: string): Promise<HousekeepingEvent | null> {
    const hotel = await this.catalog.getHotel(hotelSlug);
    return this.store.getEvent(hotel.id, id);
  }

  async setStatus(
    hotelSlug: string,
    unitId: string,
    status: unknown,
    note: string,
    today: string,
    actor: { memberId: string; assignedOnly: boolean; eventId: string; photoData: string | null },
  ): Promise<SetHousekeepingStatusResult> {
    const parsed = validateHousekeepingChange(status, actor.photoData, actor.assignedOnly);
    if (!parsed.ok) return parsed;
    const hotel = await this.catalog.getHotel(hotelSlug);
    const units = await this.repository.listPhysicalRooms(hotel.id);
    const unit = units.find((candidate) => candidate.id === unitId);
    if (!unit) return { ok: false, error: 'roomNotFound' };
    if (actor.assignedOnly) {
      const assignments = await this.store.listAssignments(hotel.id);
      if (!assignments.some((assignment) => assignment.unitId === unitId && assignment.memberId === actor.memberId)) {
        return { ok: false, error: 'notAssigned' };
      }
    }
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(actor.eventId)) return { ok: false, error: 'invalidStatus' };

    const trimmed = note.trim().slice(0, NOTE_MAX);
    const timestamp = this.clock.now().toISOString();
    const record = {
      unitId,
      hotelId: hotel.id,
      status: parsed.status,
      note: trimmed || null,
      updatedAt: timestamp,
    };
    await this.store.saveChange(record, {
      id: actor.eventId, hotelId: hotel.id, unitId, roomNumber: unit.number,
      memberId: actor.memberId, status: parsed.status, note: record.note,
      occurredAt: timestamp, photoData: actor.photoData,
    });
    const room = await this.getRoom(hotelSlug, unitId, today);
    return room ? { ok: true, room } : { ok: false, error: 'roomNotFound' };
  }
}
