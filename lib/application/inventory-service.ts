import { demoHash, nightsInRange } from '../domain/availability';
import { addIsoDays } from '../domain/dates';
import type { AvailabilityReader, BookingStore, CatalogReader, DemoControlPort } from '../domain/ports';
import { roomCategory, type RoomCategory } from '../domain/room-attributes';
import {
  allocateRoomType,
  buildRoomUnits,
  compareRoomNumbers,
  type Facade,
  type NightOccupant,
  type RoomUnit,
} from '../domain/room-units';
import type {
  Booking,
  Currency,
  Hotel,
  PriceBreakdown,
  RoomType,
  StayCriteria,
} from '../domain/schemas';
import { defaultRoomFilters, type CatalogService, type RoomFilters } from './catalog-service';

export type FloorPlanStatus = 'available' | 'booked' | 'unsuitable' | 'filtered';

export interface FloorPlanUnit {
  number: string;
  floor: number;
  facade: Facade;
  roomTypeId: string;
  roomSlug: string;
  roomName: string;
  category: RoomCategory;
  areaM2: number;
  capacity: number;
  view: RoomType['view'];
  bedType: RoomType['bedType'];
  status: FloorPlanStatus;
  /** The stay priced by the catalog, room only; null when the room can't sleep this party. */
  price: PriceBreakdown | null;
}

export interface FloorPlan {
  hotel: Hotel;
  criteria: StayCriteria;
  /** Top floor first. */
  floors: number[];
  units: FloorPlanUnit[];
  availableCount: number;
}

export type TapeChartSegment =
  | {
      kind: 'booking';
      start: number;
      span: number;
      reference: string;
      guestName: string;
      checkIn: string;
      checkOut: string;
      adults: number;
      children: number;
      total: number;
      currency: Currency;
      chosenByGuest: boolean;
      continuesBefore: boolean;
      continuesAfter: boolean;
    }
  | { kind: 'demand' | 'closed'; start: number; span: number };

export interface TapeChartRoom {
  number: string;
  floor: number;
  facade: Facade;
  segments: TapeChartSegment[];
}

export interface TapeChartGroup {
  roomTypeId: string;
  roomName: string;
  roomSlug: string;
  hidden: boolean;
  rooms: TapeChartRoom[];
}

export interface TapeChartDay {
  date: string;
  occupied: number;
  arrivals: number;
  departures: number;
}

export interface TapeChart {
  hotel: Hotel;
  dates: string[];
  totalRooms: number;
  groups: TapeChartGroup[];
  days: TapeChartDay[];
}

export interface BookingRoom {
  number: string;
  chosenByGuest: boolean;
}

function byRoomNumber(a: { number: string }, b: { number: string }): number {
  return compareRoomNumbers(a.number, b.number);
}

export class InventoryService {
  constructor(
    private readonly repository: AvailabilityReader &
      Pick<CatalogReader, 'listRooms'> &
      Pick<BookingStore, 'listBookings'>,
    private readonly demoControl: DemoControlPort,
    private readonly catalog: CatalogService,
  ) {}

  private confirmedByRoomType(bookings: Booking[]): Map<string, Booking[]> {
    const grouped = new Map<string, Booking[]>();
    for (const booking of bookings) {
      if (booking.status !== 'confirmed') continue;
      grouped.set(booking.roomTypeId, [...(grouped.get(booking.roomTypeId) ?? []), booking]);
    }
    return grouped;
  }

  private async allocate(room: RoomType, units: RoomUnit[], bookings: Booking[], nights: string[]) {
    const [availability, override] = await Promise.all([
      nights.length > 0
        ? this.repository.getAvailability(room.id, nights[0]!, addIsoDays(nights.at(-1)!, 1))
        : Promise.resolve([]),
      this.demoControl.getRoomStatusOverride(room.id),
    ]);
    const taken: Record<string, number> = {};
    for (const night of availability) taken[night.date] = Math.max(0, units.length - night.remaining);

    return allocateRoomType({
      units,
      nights,
      taken,
      closedByOverride: override !== null,
      bookings: bookings.map((booking) => ({
        reference: booking.reference,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        createdAt: booking.createdAt,
        unitNumber: booking.unitNumber,
      })),
    });
  }

  /** The guest-facing floor plan for one stay. Hidden room types are left out. */
  async getFloorPlan(hotelSlug: string, criteria: StayCriteria, filters: RoomFilters): Promise<FloorPlan> {
    const [everything, matching] = await Promise.all([
      this.catalog.search(hotelSlug, criteria, { ...defaultRoomFilters, includeSoldOut: true }),
      this.catalog.search(hotelSlug, criteria, { ...filters, includeSoldOut: true }),
    ]);
    const { hotel } = everything;
    const rooms = await this.repository.listRooms(hotel.id);
    const units = buildRoomUnits(rooms);
    const bookings = this.confirmedByRoomType(await this.repository.listBookings());
    const offers = new Map(everything.offers.map((offer) => [offer.room.id, offer]));
    const matchingIds = new Set(matching.offers.map((offer) => offer.room.id));
    const stay = nightsInRange(criteria.checkIn, criteria.checkOut);

    const planUnits = (
      await Promise.all(
        rooms
          .filter((room) => !room.hidden)
          .map(async (room) => {
            const roomUnits = units.filter((unit) => unit.roomTypeId === room.id);
            const offer = offers.get(room.id);
            if (!offer) return roomUnits.map((unit) => toPlanUnit(unit, room, 'unsuitable', null));

            const { occupancy } = await this.allocate(room, roomUnits, bookings.get(room.id) ?? [], stay);
            return roomUnits.map((unit) => {
              const row = occupancy.get(unit.number)!;
              const free = stay.every((night) => !row.has(night));
              const status: FloorPlanStatus = !matchingIds.has(room.id)
                ? 'filtered'
                : free
                  ? 'available'
                  : 'booked';
              return toPlanUnit(unit, room, status, offer.price);
            });
          }),
      )
    )
      .flat()
      .sort((a, b) => b.floor - a.floor || byRoomNumber(a, b));

    return {
      hotel,
      criteria,
      floors: [...new Set(planUnits.map((unit) => unit.floor))].sort((a, b) => b - a),
      units: planUnits,
      availableCount: planUnits.filter((unit) => unit.status === 'available').length,
    };
  }

  async isUnitFreeForStay(
    hotelSlug: string,
    roomTypeId: string,
    unitNumber: string,
    checkIn: string,
    checkOut: string,
  ): Promise<boolean> {
    const hotel = await this.catalog.getHotel(hotelSlug);
    const rooms = await this.repository.listRooms(hotel.id);
    const room = rooms.find((candidate) => candidate.id === roomTypeId && !candidate.hidden);
    if (!room) return false;

    const units = buildRoomUnits(rooms).filter((unit) => unit.roomTypeId === room.id);
    if (!units.some((unit) => unit.number === unitNumber)) return false;

    const bookings = this.confirmedByRoomType(await this.repository.listBookings()).get(room.id) ?? [];
    const stay = nightsInRange(checkIn, checkOut);
    const { occupancy } = await this.allocate(room, units, bookings, stay);
    const row = occupancy.get(unitNumber)!;
    return stay.every((night) => !row.has(night));
  }

  /** The PMS view: every room, including hidden room types, across a window of nights. */
  async getTapeChart(hotelSlug: string, from: string, days: number): Promise<TapeChart> {
    const hotel = await this.catalog.getHotel(hotelSlug);
    const rooms = await this.repository.listRooms(hotel.id);
    const units = buildRoomUnits(rooms);
    const allBookings = await this.repository.listBookings();
    const confirmed = allBookings.filter((booking) => booking.status === 'confirmed');
    const bookingsByType = this.confirmedByRoomType(allBookings);
    const byReference = new Map(allBookings.map((booking) => [booking.reference, booking]));
    const dates = Array.from({ length: days }, (_, index) => addIsoDays(from, index));

    const groups: TapeChartGroup[] = await Promise.all(
      rooms.map(async (room) => {
        const roomUnits = units.filter((unit) => unit.roomTypeId === room.id).sort(byRoomNumber);
        const { occupancy } = await this.allocate(room, roomUnits, bookingsByType.get(room.id) ?? [], dates);
        return {
          roomTypeId: room.id,
          roomName: room.name,
          roomSlug: room.slug,
          hidden: Boolean(room.hidden),
          rooms: roomUnits.map((unit) => ({
            number: unit.number,
            floor: unit.floor,
            facade: unit.facade,
            segments: toSegments(occupancy.get(unit.number)!, dates, byReference, unit.number),
          })),
        };
      }),
    );

    const summary: TapeChartDay[] = dates.map((date, index) => ({
      date,
      occupied: groups.reduce(
        (sum, group) =>
          sum +
          group.rooms.filter((room) =>
            room.segments.some((segment) => segment.start <= index && index < segment.start + segment.span),
          ).length,
        0,
      ),
      arrivals: confirmed.filter((booking) => booking.checkIn === date).length,
      departures: confirmed.filter((booking) => booking.checkOut === date).length,
    }));

    return { hotel, dates, totalRooms: units.length, groups, days: summary };
  }

  /** The room a booking is in: the one the guest chose, or where the allocation placed it. */
  async getBookingRoom(booking: Booking): Promise<BookingRoom | null> {
    if (booking.status !== 'confirmed') {
      return booking.unitNumber ? { number: booking.unitNumber, chosenByGuest: true } : null;
    }
    const rooms = await this.repository.listRooms(booking.hotelId);
    const room = rooms.find((candidate) => candidate.id === booking.roomTypeId);
    if (!room) return null;

    const units = buildRoomUnits(rooms).filter((unit) => unit.roomTypeId === room.id);
    const bookings = this.confirmedByRoomType(await this.repository.listBookings()).get(room.id) ?? [];
    const { assignments } = await this.allocate(
      room,
      units,
      bookings,
      nightsInRange(booking.checkIn, booking.checkOut),
    );
    const number = assignments.get(booking.reference);
    return number ? { number, chosenByGuest: booking.unitNumber === number } : null;
  }
}

function toPlanUnit(
  unit: RoomUnit,
  room: RoomType,
  status: FloorPlanStatus,
  price: PriceBreakdown | null,
): FloorPlanUnit {
  return {
    number: unit.number,
    floor: unit.floor,
    facade: unit.facade,
    roomTypeId: room.id,
    roomSlug: room.slug,
    roomName: room.name,
    category: roomCategory(room),
    areaM2: room.areaM2,
    capacity: room.capacity,
    view: room.view,
    bedType: room.bedType,
    status,
    price,
  };
}

function sameOccupant(a: NightOccupant | undefined, b: NightOccupant): boolean {
  if (!a || a.kind !== b.kind) return false;
  return a.kind !== 'booking' || a.reference === (b as { reference: string }).reference;
}

function toSegments(
  row: Map<string, NightOccupant>,
  dates: string[],
  bookings: Map<string, Booking>,
  unitNumber: string,
): TapeChartSegment[] {
  const segments: TapeChartSegment[] = [];
  const windowEnd = addIsoDays(dates.at(-1)!, 1);
  let index = 0;

  while (index < dates.length) {
    const occupant = row.get(dates[index]!);
    if (!occupant) {
      index += 1;
      continue;
    }
    let end = index + 1;
    while (end < dates.length && sameOccupant(row.get(dates[end]!), occupant)) end += 1;

    if (occupant.kind === 'booking') {
      const booking = bookings.get(occupant.reference);
      if (booking) {
        segments.push({
          kind: 'booking',
          start: index,
          span: end - index,
          reference: booking.reference,
          guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          adults: booking.adults,
          children: booking.children,
          total: booking.total,
          currency: booking.currency,
          chosenByGuest: booking.unitNumber === unitNumber,
          continuesBefore: booking.checkIn < dates[0]!,
          continuesAfter: booking.checkOut > windowEnd,
        });
      }
    } else if (occupant.kind === 'closed') {
      segments.push({ kind: 'closed', start: index, span: end - index });
    } else {
      // Simulated demand is one long run per room; cut it into stay-sized blocks so it reads like a
      // PMS. A block breaks on nights the hash picks from the room and the date alone, so paging the
      // window never redraws the same nights as different stays.
      let cursor = index;
      for (let night = index + 1; night <= end; night += 1) {
        if (night === end || demoHash(`${unitNumber}|${dates[night]}`) % 3 === 0) {
          segments.push({ kind: 'demand', start: cursor, span: night - cursor });
          cursor = night;
        }
      }
    }
    index = end;
  }

  return segments;
}
