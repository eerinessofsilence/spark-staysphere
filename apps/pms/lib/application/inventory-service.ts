import { demoHash, nightsInRange } from '../domain/availability';
import { addIsoDays } from '../domain/dates';
import { buildPriceBreakdown, roundMoney } from '../domain/pricing';
import { LATE_CHECK_OUT_TIME, STANDARD_CHECK_IN_TIME, STANDARD_CHECK_OUT_TIME } from '../domain/stay-times';
import type {
  AvailabilityReader,
  BookingStore,
  CatalogReader,
  DemoControlPort,
  PaymentAttemptStore,
} from '../domain/ports';
import { coverPhoto, roomCategory, type RoomCategory } from '../domain/room-attributes';
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
  RatePlan,
  RoomType,
  StayState,
  StayCriteria,
  BookingRoomAssignment,
} from '../domain/schemas';
import { defaultRoomFilters, type CatalogService, type RoomFilters } from './catalog-service';
import type { BookingChange } from './email-automations-service';

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

/** What the desk needs to read a stay at a glance, whether it's a real booking or simulated demand. */
export interface FrontDeskStay {
  guestName: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  ratePlanName: string;
  breakfastIncluded: boolean;
  /** Hotel-local times, `HH:mm`. Check-out moves to 18:00 with the late check-out add-on. */
  checkInTime: string;
  checkOutTime: string;
  lateCheckIn?: boolean;
  lateCheckOut?: boolean;
  total: number;
  paid: number;
  currency: Currency;
}

export type FrontDeskSegment =
  | ({
      kind: 'booking';
      start: number;
      span: number;
      reference: string;
      status: Booking['status'];
      stayState: StayState;
      guestEmail: string;
      guestPhone: string;
      chosenByGuest: boolean;
      continuesBefore: boolean;
      continuesAfter: boolean;
      roomFrom: string;
      roomTo: string;
      moveFromRoomNumber?: string;
      moveToRoomNumber?: string;
      moveReason?: string;
      movedAt?: string;
    } & FrontDeskStay)
  | ({
      kind: 'demand';
      start: number;
      span: number;
      /** Where the simulated stay "came from" — an OTA, the phone, the lobby. */
      channel: string;
    } & FrontDeskStay)
  | { kind: 'closed'; start: number; span: number };

export interface FrontDeskRoom {
  number: string;
  floor: number;
  facade: Facade;
  segments: FrontDeskSegment[];
}

export interface FrontDeskGroup {
  roomTypeId: string;
  roomName: string;
  roomDescription: string;
  roomSlug: string;
  /** The room type's cover photograph, for the stay card. */
  photo: { url: string; width?: number; height?: number } | null;
  hidden: boolean;
  rooms: FrontDeskRoom[];
}

export interface FrontDeskDay {
  date: string;
  occupied: number;
  arrivals: number;
  departures: number;
}

export interface FrontDesk {
  hotel: Hotel;
  dates: string[];
  totalRooms: number;
  groups: FrontDeskGroup[];
  days: FrontDeskDay[];
}

export interface BookingRoom {
  number: string;
  chosenByGuest: boolean;
}

export interface RoomTypeMoveReview {
  reference: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  fromDate: string;
  fromRoomNumber: string;
  targetRoomNumber: string;
  /** The room row that received the drop; may differ when it is busy later in the stay. */
  requestedTargetRoomNumber: string;
  fromRoomType: string;
  targetRoomType: string;
  oldTotal: number;
  newTotal: number;
  oldNightly: number;
  newNightly: number;
  nights: number;
  currency: Currency;
}

export interface StayExtensionReview {
  reference: string;
  guestName: string;
  checkIn: string;
  newCheckIn: string;
  oldCheckOut: string;
  newCheckOut: string;
  roomNumber: string;
  oldTotal: number;
  newTotal: number;
  oldNights: number;
  newNights: number;
  currency: Currency;
}

export type RoomTypeMoveError = 'not_found' | 'invalid_date' | 'same_room' | 'unavailable' | 'price_changed' | 'save_failed';
export type StayExtensionError = 'not_found' | 'invalid_date' | 'unavailable' | 'price_changed' | 'save_failed';

function byRoomNumber(a: { number: string }, b: { number: string }): number {
  return compareRoomNumbers(a.number, b.number);
}

export class InventoryService {
  constructor(
    private readonly repository: AvailabilityReader &
      Pick<CatalogReader, 'listRooms' | 'listPhysicalRooms' | 'listRatePlans' | 'listAddOns'> &
      Pick<BookingStore, 'listBookings' | 'findBookingByIdempotencyKey' | 'saveBooking' | 'saveBookingRoomAssignments' | 'transferBookingRoomType' | 'changeBookingStayDates' | 'changeBookingStayTimes'> &
      Pick<PaymentAttemptStore, 'listPaymentAttempts' | 'savePaymentAttempt'>,
    private readonly demoControl: DemoControlPort,
    private readonly catalog: CatalogService,
    private readonly afterBookingChanged?: (booking: Booking, change: BookingChange) => Promise<void>,
  ) {}

  /** Persist a selected demo stay so it uses the same editing and status rules as every reservation. */
  async openDemoStay(hotelSlug: string, input: { from: string; days: number; roomTypeId: string; roomNumber: string; checkIn: string; checkOut: string }): Promise<Extract<FrontDeskSegment, { kind: 'booking' }>> {
    const hotel = await this.catalog.getHotel(hotelSlug);
    const key = `front-desk-demo:${hotel.id}:${input.roomTypeId}:${input.roomNumber}:${input.checkIn}:${input.checkOut}`;
    let booking = await this.repository.findBookingByIdempotencyKey(key);
    if (!booking) {
      // Derive the guest and price from the current board, never from client-submitted amounts.
      const board = await this.getFrontDesk(hotelSlug, input.from, input.days);
      const group = board.groups.find((item) => item.roomTypeId === input.roomTypeId);
      const segment = group?.rooms.find((item) => item.number === input.roomNumber)?.segments.find((item) =>
        item.kind === 'demand' && item.checkIn === input.checkIn && item.checkOut === input.checkOut);
      if (!group || !segment || segment.kind !== 'demand') throw new Error('Demo stay is no longer available.');
      const plans = await this.repository.listRatePlans(input.roomTypeId);
      const plan = plans[0];
      const [firstName, ...lastName] = segment.guestName.split(' ');
      const id = crypto.randomUUID();
      booking = await this.repository.saveBooking({
        id, reference: `FD${id.replaceAll('-', '').slice(0, 10).toUpperCase()}`, idempotencyKey: key,
        hotelId: hotel.id, roomTypeId: input.roomTypeId, ratePlanId: plan?.id ?? 'demo-standard',
        checkIn: segment.checkIn, checkOut: segment.checkOut,
        checkInTime: segment.checkInTime, checkOutTime: segment.checkOutTime,
        adults: segment.adults, children: segment.children,
        guest: { firstName: firstName!, lastName: lastName.join(' ') || 'Guest', email: `demo-${id}@example.invalid`, phone: '0000000' },
        addOnIds: [], unitNumber: input.roomNumber, total: segment.total, currency: segment.currency,
        status: 'confirmed', stayState: 'booked', createdAt: new Date().toISOString(),
      }, group.rooms.length);
      if (segment.paid > 0) {
        await this.repository.savePaymentAttempt({
          id: `front-desk-demo:${booking.id}`, bookingId: booking.id, provider: 'card', status: 'authorized',
          amount: segment.paid, currency: segment.currency, createdAt: booking.createdAt,
          comment: 'Demo payment carried over from simulated occupancy. No payment was processed.',
        });
      }
    }
    const board = await this.getFrontDesk(hotelSlug, input.from, input.days);
    const segment = board.groups.flatMap((group) => group.rooms.flatMap((room) => room.segments))
      .find((item) => item.kind === 'booking' && item.reference === booking.reference);
    if (!segment || segment.kind !== 'booking') throw new Error('Booking is outside the current board.');
    return segment;
  }

  private async notifyBookingChanged(reference: string, change: BookingChange): Promise<void> {
    if (!this.afterBookingChanged) return;
    try {
      const current = (await this.repository.listBookings()).find((booking) => booking.reference === reference);
      if (current) await this.afterBookingChanged(current, change);
    } catch {
      // The persisted room or date change remains valid even if email is unavailable.
    }
  }

  private confirmedByRoomType(bookings: Booking[]): Map<string, Booking[]> {
    const grouped = new Map<string, Booking[]>();
    for (const booking of bookings) {
      if (booking.status !== 'confirmed') continue;
      const types = booking.roomAssignments?.length
        ? new Set(booking.roomAssignments.map((period) => period.roomTypeId ?? booking.roomTypeId))
        : new Set([booking.roomTypeId]);
      for (const typeId of types) grouped.set(typeId, [...(grouped.get(typeId) ?? []), booking]);
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
      override,
      bookings: bookings.map((booking) => ({
        reference: booking.reference,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        createdAt: booking.createdAt,
        unitNumber: booking.unitNumber,
        roomAssignments: booking.roomAssignments?.filter((period) => (period.roomTypeId ?? booking.roomTypeId) === room.id),
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
    const units = buildRoomUnits(rooms, await this.repository.listPhysicalRooms(hotel.id));
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

    const units = buildRoomUnits(rooms, await this.repository.listPhysicalRooms(room.hotelId)).filter(
      (unit) => unit.roomTypeId === room.id,
    );
    if (!units.some((unit) => unit.number === unitNumber)) return false;

    const bookings = this.confirmedByRoomType(await this.repository.listBookings()).get(room.id) ?? [];
    const stay = nightsInRange(checkIn, checkOut);
    const { occupancy } = await this.allocate(room, units, bookings, stay);
    const row = occupancy.get(unitNumber)!;
    return stay.every((night) => !row.has(night));
  }

  /** Split one confirmed stay into room periods without creating a second booking or payment. */
  async moveBookingRoom(
    hotelSlug: string,
    reference: string,
    nextRoomNumber: string,
    effectiveDate: string,
    reason: string,
    movedBy: string,
  ): Promise<'ok' | 'not_found' | 'invalid_date' | 'same_room' | 'unavailable' | 'save_failed'> {
    const booking = (await this.repository.listBookings()).find((item) => item.reference === reference);
    if (!booking || booking.status !== 'confirmed') return 'not_found';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) || effectiveDate <= booking.checkIn || effectiveDate >= booking.checkOut) {
      return 'invalid_date';
    }
    const hotel = await this.catalog.getHotel(hotelSlug);
    if (hotel.id !== booking.hotelId) return 'not_found';
    const rooms = await this.repository.listRooms(hotel.id);
    const room = rooms.find((candidate) => candidate.id === booking.roomTypeId);
    if (!room) return 'not_found';
    const units = buildRoomUnits(rooms, await this.repository.listPhysicalRooms(hotel.id)).filter(
      (unit) => unit.roomTypeId === room.id,
    );
    if (!units.some((unit) => unit.number === nextRoomNumber)) return 'unavailable';

    const currentAssignments = booking.roomAssignments?.length
      ? [...booking.roomAssignments]
      : [{
          roomNumber: booking.unitNumber ?? (await this.allocate(
            room,
            units,
            this.confirmedByRoomType(await this.repository.listBookings()).get(room.id) ?? [],
            nightsInRange(booking.checkIn, booking.checkOut),
          )).assignments.get(reference) ?? '',
          fromDate: booking.checkIn,
          toDate: booking.checkOut,
        }];
    const active = currentAssignments.find((assignment) =>
      assignment.fromDate < effectiveDate && effectiveDate < assignment.toDate,
    );
    if (!active?.roomNumber) return 'invalid_date';
    if (active.roomNumber === nextRoomNumber) return 'same_room';

    const allBookings = this.confirmedByRoomType(await this.repository.listBookings()).get(room.id) ?? [];
    const { occupancy } = await this.allocate(room, units, allBookings, nightsInRange(effectiveDate, booking.checkOut));
    const target = occupancy.get(nextRoomNumber);
    const bookingRef = booking.reference;
    if (!target || nightsInRange(effectiveDate, booking.checkOut).some((night) => {
      const occupant = target.get(night);
      return occupant && !(occupant.kind === 'booking' && occupant.reference === bookingRef);
    })) return 'unavailable';

    const now = new Date().toISOString();
    const reasonText = reason.trim().slice(0, 200) || 'Guest request';
    const updated = currentAssignments.flatMap((assignment): BookingRoomAssignment[] => {
      if (assignment !== active) return assignment.fromDate >= effectiveDate ? [] : [assignment];
      return [
        { ...assignment, toDate: effectiveDate, moveToRoomNumber: nextRoomNumber },
        {
          roomNumber: nextRoomNumber,
          fromDate: effectiveDate,
          toDate: booking.checkOut,
          moveFromRoomNumber: active.roomNumber,
          moveReason: reasonText,
          movedAt: now,
          movedBy,
        },
      ];
    }).sort((a, b) => a.fromDate.localeCompare(b.fromDate));
    const saved = await this.repository.saveBookingRoomAssignments(booking.id, updated);
    if (saved) await this.notifyBookingChanged(reference, { kind: 'room', oldRoom: active.roomNumber, newRoom: nextRoomNumber, effectiveDate });
    return saved ? 'ok' : 'save_failed';
  }

  /** Move the visible room period of a confirmed stay to another unit of its current room type. */
  async moveBookingRoomPeriod(
    hotelSlug: string,
    reference: string,
    fromRoomNumber: string,
    nextRoomNumber: string,
    targetRoomTypeId: string,
    fromDate: string,
    toDate: string,
    reason: string,
    movedBy: string,
  ): Promise<'ok' | 'not_found' | 'invalid_date' | 'same_room' | 'unavailable' | 'room_type_change_required' | 'save_failed'> {
    const bookings = await this.repository.listBookings();
    const booking = bookings.find((item) => item.reference === reference);
    if (!booking || booking.status !== 'confirmed') return 'not_found';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) ||
      fromDate < booking.checkIn || toDate > booking.checkOut || fromDate >= toDate) return 'invalid_date';
    if (fromRoomNumber === nextRoomNumber) return 'same_room';

    const hotel = await this.catalog.getHotel(hotelSlug);
    if (hotel.id !== booking.hotelId) return 'not_found';
    const rooms = await this.repository.listRooms(hotel.id);
    const room = rooms.find((candidate) => candidate.id === booking.roomTypeId);
    if (!room) return 'not_found';
    if (targetRoomTypeId !== room.id) return 'room_type_change_required';

    const units = buildRoomUnits(rooms, await this.repository.listPhysicalRooms(hotel.id)).filter(
      (unit) => unit.roomTypeId === room.id,
    );
    if (!units.some((unit) => unit.number === fromRoomNumber) || !units.some((unit) => unit.number === nextRoomNumber)) {
      return 'unavailable';
    }

    const currentAssignments = booking.roomAssignments?.length
      ? [...booking.roomAssignments]
      : [{
          roomNumber: booking.unitNumber ?? (await this.allocate(
            room,
            units,
            this.confirmedByRoomType(bookings).get(room.id) ?? [],
            nightsInRange(booking.checkIn, booking.checkOut),
          )).assignments.get(reference) ?? '',
          fromDate: booking.checkIn,
          toDate: booking.checkOut,
        }];
    const active = currentAssignments.find((assignment) =>
      assignment.roomNumber === fromRoomNumber && assignment.fromDate <= fromDate && assignment.toDate >= toDate,
    );
    if (!active?.roomNumber) return 'invalid_date';

    const { occupancy } = await this.allocate(
      room,
      units,
      this.confirmedByRoomType(bookings).get(room.id) ?? [],
      nightsInRange(fromDate, toDate),
    );
    const target = occupancy.get(nextRoomNumber);
    if (!target || nightsInRange(fromDate, toDate).some((night) => {
      const occupant = target.get(night);
      return occupant && !(occupant.kind === 'booking' && occupant.reference === reference);
    })) return 'unavailable';

    const now = new Date().toISOString();
    const reasonText = reason.trim().slice(0, 200) || 'Front desk room reassignment';
    const updated = currentAssignments.flatMap((assignment): BookingRoomAssignment[] => {
      if (assignment !== active) return [assignment];
      const periods: BookingRoomAssignment[] = [];
      if (assignment.fromDate < fromDate) {
        periods.push({ ...assignment, toDate: fromDate, moveToRoomNumber: nextRoomNumber });
      }
      periods.push({
        ...assignment,
        roomNumber: nextRoomNumber,
        fromDate,
        toDate,
        moveFromRoomNumber: fromRoomNumber,
        moveToRoomNumber: undefined,
        moveReason: reasonText,
        movedAt: now,
        movedBy,
      });
      if (toDate < assignment.toDate) periods.push({ ...assignment, fromDate: toDate });
      return periods;
    }).sort((a, b) => a.fromDate.localeCompare(b.fromDate));

    const saved = await this.repository.saveBookingRoomAssignments(booking.id, updated);
    if (saved) await this.notifyBookingChanged(reference, { kind: 'room', oldRoom: fromRoomNumber, newRoom: nextRoomNumber, effectiveDate: fromDate });
    return saved ? 'ok' : 'save_failed';
  }

  private async prepareRoomTypeMove(
    hotelSlug: string,
    reference: string,
    sourceRoomTypeId: string,
    fromRoomNumber: string,
    targetRoomTypeId: string,
    targetRoomNumber: string,
    fromDate: string,
  ): Promise<
    | { ok: false; reason: RoomTypeMoveError }
    | { ok: true; review: RoomTypeMoveReview; booking: Booking; assignments: BookingRoomAssignment[];
        oldNightsByType: Record<string, string[]>; targetRatePlanId: string; capacity: number }
  > {
    const hotel = await this.catalog.getHotel(hotelSlug);
    const booking = (await this.repository.listBookings({ hotelId: hotel.id })).find((item) => item.reference === reference);
    if (!booking || booking.status !== 'confirmed') return { ok: false, reason: 'not_found' };
    const today = new Date().toISOString().slice(0, 10);
    if (fromDate < today || fromDate < booking.checkIn || fromDate >= booking.checkOut) {
      return { ok: false, reason: 'invalid_date' };
    }
    if (sourceRoomTypeId === targetRoomTypeId) return { ok: false, reason: 'same_room' };

    const [rooms, physicalRooms, sourcePlans, targetPlans] = await Promise.all([
      this.repository.listRooms(hotel.id),
      this.repository.listPhysicalRooms(hotel.id),
      this.repository.listRatePlans(sourceRoomTypeId),
      this.repository.listRatePlans(targetRoomTypeId),
    ]);
    const source = rooms.find((room) => room.id === sourceRoomTypeId);
    const target = rooms.find((room) => room.id === targetRoomTypeId && !room.hidden);
    const oldPlan = sourcePlans.find((plan) => plan.id === booking.ratePlanId) ?? sourcePlans[0];
    const newPlan = targetPlans[0];
    const targetUnits = buildRoomUnits(rooms, physicalRooms).filter((unit) => unit.roomTypeId === targetRoomTypeId);
    if (!source || !target || !oldPlan || !newPlan || newPlan.currency !== booking.currency ||
      target.capacity < booking.adults + booking.children ||
      !targetUnits.some((unit) => unit.number === targetRoomNumber)) return { ok: false, reason: 'unavailable' };

    const existingAssignments: BookingRoomAssignment[] = booking.roomAssignments?.length
      ? [...booking.roomAssignments]
      : [{
          roomNumber: booking.unitNumber ?? (await this.allocate(
            source, buildRoomUnits(rooms, physicalRooms).filter((unit) => unit.roomTypeId === source.id),
            this.confirmedByRoomType(await this.repository.listBookings({ hotelId: hotel.id })).get(source.id) ?? [],
            nightsInRange(booking.checkIn, booking.checkOut),
          )).assignments.get(reference) ?? '',
          roomTypeId: source.id,
          fromDate: booking.checkIn,
          toDate: booking.checkOut,
        }];
    const active = existingAssignments.find((period) =>
      period.roomNumber === fromRoomNumber &&
      (period.roomTypeId ?? booking.roomTypeId) === sourceRoomTypeId &&
      period.fromDate <= fromDate && fromDate < period.toDate,
    );
    if (!active) return { ok: false, reason: 'invalid_date' };
    // The desk may be showing only part of a stay. A row that looks empty in
    // that window can be occupied later, so retain the requested room when it
    // fits the full remaining stay and otherwise select a free unit in the
    // same target type before showing the price review.
    const targetCandidates = [
      targetRoomNumber,
      ...targetUnits.map((unit) => unit.number).filter((number) => number !== targetRoomNumber),
    ];
    const resolvedTargetRoomNumber = (await Promise.all(
      targetCandidates.map(async (number) => ({
        number,
        free: await this.isUnitFreeForStay(hotelSlug, targetRoomTypeId, number, fromDate, booking.checkOut),
      })),
    )).find((candidate) => candidate.free)?.number;
    if (!resolvedTargetRoomNumber) return { ok: false, reason: 'unavailable' };

    const nights = nightsInRange(fromDate, booking.checkOut);
    const newTotal = roundMoney(booking.total + nights.reduce((sum, date) => sum +
      (newPlan.nightlyPriceOverrides?.[date] ?? newPlan.nightlyPrice) -
      (oldPlan.nightlyPriceOverrides?.[date] ?? oldPlan.nightlyPrice), 0));
    if (newTotal < 0) return { ok: false, reason: 'unavailable' };
    const oldNightsByType: Record<string, string[]> = {};
    for (const night of nights) {
      const period = existingAssignments.find((item) => item.fromDate <= night && night < item.toDate);
      const typeId = period?.roomTypeId ?? booking.roomTypeId;
      if (typeId !== targetRoomTypeId) (oldNightsByType[typeId] ??= []).push(night);
    }
    const movedAt = new Date().toISOString();
    const assignments: BookingRoomAssignment[] = existingAssignments.flatMap((period) => {
      if (period.toDate <= fromDate) return [{ ...period, roomTypeId: period.roomTypeId ?? booking.roomTypeId }];
      if (period.fromDate >= fromDate) return [];
      return [{ ...period, roomTypeId: period.roomTypeId ?? booking.roomTypeId, toDate: fromDate,
        moveToRoomNumber: resolvedTargetRoomNumber }];
    });
    assignments.push({
      roomTypeId: targetRoomTypeId,
      roomNumber: resolvedTargetRoomNumber,
      fromDate,
      toDate: booking.checkOut,
      moveFromRoomNumber: fromRoomNumber,
      moveReason: 'Room type transfer',
      movedAt,
    });
    return {
      ok: true,
      review: {
        reference,
        guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        fromDate,
        fromRoomNumber,
        targetRoomNumber: resolvedTargetRoomNumber,
        requestedTargetRoomNumber: targetRoomNumber,
        fromRoomType: source.name,
        targetRoomType: target.name,
        oldTotal: booking.total,
        newTotal,
        oldNightly: roundMoney(nights.reduce((sum, date) => sum + (oldPlan.nightlyPriceOverrides?.[date] ?? oldPlan.nightlyPrice), 0) / nights.length),
        newNightly: roundMoney(nights.reduce((sum, date) => sum + (newPlan.nightlyPriceOverrides?.[date] ?? newPlan.nightlyPrice), 0) / nights.length),
        nights: nights.length,
        currency: booking.currency,
      },
      booking,
      assignments,
      oldNightsByType,
      targetRatePlanId: newPlan.id,
      capacity: targetUnits.length,
    };
  }

  async reviewRoomTypeMove(
    hotelSlug: string, reference: string, sourceRoomTypeId: string, fromRoomNumber: string,
    targetRoomTypeId: string, targetRoomNumber: string, fromDate: string,
  ): Promise<{ ok: true; review: RoomTypeMoveReview } | { ok: false; reason: RoomTypeMoveError }> {
    const prepared = await this.prepareRoomTypeMove(hotelSlug, reference, sourceRoomTypeId, fromRoomNumber,
      targetRoomTypeId, targetRoomNumber, fromDate);
    return prepared.ok ? { ok: true, review: prepared.review } : prepared;
  }

  async confirmRoomTypeMove(
    hotelSlug: string, reference: string, sourceRoomTypeId: string, fromRoomNumber: string,
    targetRoomTypeId: string, targetRoomNumber: string, fromDate: string,
    expectedOldTotal: number, expectedNewTotal: number,
  ): Promise<'ok' | RoomTypeMoveError> {
    const prepared = await this.prepareRoomTypeMove(hotelSlug, reference, sourceRoomTypeId, fromRoomNumber,
      targetRoomTypeId, targetRoomNumber, fromDate);
    if (!prepared.ok) return prepared.reason;
    if (prepared.review.oldTotal !== expectedOldTotal || prepared.review.newTotal !== expectedNewTotal) return 'price_changed';
    const saved = await this.repository.transferBookingRoomType({
      bookingId: prepared.booking.id,
      expectedRoomTypeId: prepared.booking.roomTypeId,
      expectedTotal: prepared.booking.total,
      sourceRoomTypeId,
      sourceRoomNumber: fromRoomNumber,
      targetRoomTypeId,
      targetRatePlanId: prepared.targetRatePlanId,
      targetRoomNumber,
      newTotal: prepared.review.newTotal,
      capacity: prepared.capacity,
      fromDate,
      checkOut: prepared.booking.checkOut,
      oldNightsByType: prepared.oldNightsByType,
      assignments: prepared.assignments,
    });
    if (saved) await this.notifyBookingChanged(reference, {
      kind: 'room_type',
      oldRoomType: prepared.review.fromRoomType,
      newRoomType: prepared.review.targetRoomType,
      newRoom: prepared.review.targetRoomNumber,
      effectiveDate: fromDate,
      newTotal: prepared.review.newTotal,
    });
    return saved ? 'ok' : 'unavailable';
  }

  private async prepareStayExtension(
    hotelSlug: string, reference: string, roomTypeId: string, roomNumber: string, newCheckIn: string, newCheckOut: string,
  ): Promise<
    | { ok: false; reason: StayExtensionError }
    | { ok: true; review: StayExtensionReview; booking: Booking; capacity: number; addedNights: string[]; releasedNights: string[]; assignments: BookingRoomAssignment[] }
  > {
    const hotel = await this.catalog.getHotel(hotelSlug);
    const booking = (await this.repository.listBookings({ hotelId: hotel.id })).find((item) => item.reference === reference);
    const today = new Date().toISOString().slice(0, 10);
    if (!booking || booking.status !== 'confirmed') return { ok: false, reason: 'not_found' };
    if ((newCheckIn === booking.checkIn && newCheckOut === booking.checkOut) || booking.checkOut < today ||
      (newCheckIn !== booking.checkIn && newCheckIn < today) ||
      (newCheckOut !== booking.checkOut && newCheckOut <= today) || newCheckIn >= newCheckOut) return { ok: false, reason: 'invalid_date' };
    const [rooms, physicalRooms, addOns] = await Promise.all([
      this.repository.listRooms(hotel.id), this.repository.listPhysicalRooms(hotel.id), this.repository.listAddOns(hotel.id),
    ]);
    const units = buildRoomUnits(rooms, physicalRooms).filter((unit) => unit.roomTypeId === roomTypeId);
    const activeType = booking.roomAssignments?.find((period) => period.roomNumber === roomNumber && period.toDate === booking.checkOut)?.roomTypeId
      ?? booking.roomTypeId;
    if (activeType !== roomTypeId || !units.some((unit) => unit.number === roomNumber)) return { ok: false, reason: 'invalid_date' };
    if (booking.roomAssignments?.some((period) => period.roomNumber !== roomNumber || (period.roomTypeId ?? booking.roomTypeId) !== roomTypeId)) {
      return { ok: false, reason: 'invalid_date' };
    }
    const plan = (await this.repository.listRatePlans(roomTypeId)).find((item) => item.id === booking.ratePlanId);
    const bookingNights = nightsInRange(booking.checkIn, booking.checkOut);
    const nextNights = nightsInRange(newCheckIn, newCheckOut);
    const bookingSet = new Set(bookingNights);
    const nextSet = new Set(nextNights);
    const addedNights = nextNights.filter((night) => !bookingSet.has(night));
    const releasedNights = bookingNights.filter((night) => !nextSet.has(night));
    if (!plan || plan.currency !== booking.currency || (addedNights.length > 0 && !(await this.isUnitFreeForStay(hotelSlug, roomTypeId, roomNumber,
      addedNights[0]!, addIsoDays(addedNights.at(-1)!, 1))))) return { ok: false, reason: 'unavailable' };
    const oldNights = nightsInRange(booking.checkIn, booking.checkOut).length;
    const newNights = nextNights.length;
    const chosenAddOns = addOns.filter((addOn) => booking.addOnIds.includes(addOn.id));
    const oldRate = buildPriceBreakdown({ ratePlan: plan, checkIn: booking.checkIn, addOns: chosenAddOns, nights: oldNights, adults: booking.adults, children: booking.children });
    const newRate = buildPriceBreakdown({ ratePlan: plan, checkIn: newCheckIn, addOns: chosenAddOns, nights: newNights, adults: booking.adults, children: booking.children });
    const newTotal = roundMoney(booking.total + newRate.total - oldRate.total);
    const baseAssignments: BookingRoomAssignment[] = booking.roomAssignments?.length
      ? booking.roomAssignments.map((period) => ({ ...period, roomTypeId: period.roomTypeId ?? booking.roomTypeId }))
      : [{ roomNumber, roomTypeId, fromDate: booking.checkIn, toDate: booking.checkOut }];
    const last = baseAssignments.findIndex((period) => period.roomNumber === roomNumber && period.roomTypeId === roomTypeId && period.toDate === booking.checkOut);
    if (last < 0) return { ok: false, reason: 'invalid_date' };
    const assignments = baseAssignments.flatMap((period, index) => {
      const fromDate = index === 0 ? newCheckIn : period.fromDate < newCheckIn ? newCheckIn : period.fromDate;
      const toDate = index === last ? newCheckOut : period.toDate > newCheckOut ? newCheckOut : period.toDate;
      return fromDate < toDate ? [{ ...period, fromDate, toDate }] : [];
    });
    return { ok: true, booking, capacity: units.length, addedNights, releasedNights, assignments,
      review: { reference, guestName: `${booking.guest.firstName} ${booking.guest.lastName}`, checkIn: booking.checkIn, newCheckIn,
        oldCheckOut: booking.checkOut, newCheckOut, roomNumber, oldTotal: booking.total, newTotal, oldNights, newNights, currency: booking.currency } };
  }

  async reviewStayExtension(hotelSlug: string, reference: string, roomTypeId: string, roomNumber: string, newCheckIn: string, newCheckOut: string) {
    const prepared = await this.prepareStayExtension(hotelSlug, reference, roomTypeId, roomNumber, newCheckIn, newCheckOut);
    return prepared.ok ? { ok: true as const, review: prepared.review } : prepared;
  }

  async confirmStayExtension(hotelSlug: string, reference: string, roomTypeId: string, roomNumber: string, newCheckIn: string, newCheckOut: string,
    expectedOldTotal: number, expectedNewTotal: number): Promise<'ok' | StayExtensionError> {
    const prepared = await this.prepareStayExtension(hotelSlug, reference, roomTypeId, roomNumber, newCheckIn, newCheckOut);
    if (!prepared.ok) return prepared.reason;
    if (prepared.review.oldTotal !== expectedOldTotal || prepared.review.newTotal !== expectedNewTotal) return 'price_changed';
    const saved = await this.repository.changeBookingStayDates({ bookingId: prepared.booking.id, expectedCheckIn: prepared.booking.checkIn,
      expectedCheckOut: prepared.booking.checkOut, expectedTotal: prepared.booking.total, roomTypeId, roomNumber,
      newCheckIn: prepared.review.newCheckIn, newCheckOut: prepared.review.newCheckOut, newTotal: prepared.review.newTotal,
      capacity: prepared.capacity, addedNights: prepared.addedNights, releasedNights: prepared.releasedNights, assignments: prepared.assignments });
    if (saved) await this.notifyBookingChanged(reference, {
      kind: 'dates',
      oldCheckIn: prepared.review.checkIn,
      oldCheckOut: prepared.review.oldCheckOut,
      newCheckIn: prepared.review.newCheckIn,
      newCheckOut: prepared.review.newCheckOut,
      newTotal: prepared.review.newTotal,
    });
    return saved ? 'ok' : 'unavailable';
  }

  async changeStayTimes(hotelSlug: string, reference: string, checkInTime: string, checkOutTime: string, lateCheckIn: boolean, lateCheckOut: boolean): Promise<'ok' | 'not_found' | 'unchanged' | 'unavailable'> {
    const hotel = await this.catalog.getHotel(hotelSlug);
    const booking = (await this.repository.listBookings({ hotelId: hotel.id })).find((item) => item.reference === reference);
    if (!booking || booking.status !== 'confirmed' || booking.checkOut <= new Date().toISOString().slice(0, 10)) return 'not_found';
    const oldCheckInTime = booking.checkInTime ?? STANDARD_CHECK_IN_TIME;
    const oldCheckOutTime = booking.checkOutTime ?? (booking.addOnIds.includes('addon_late') ? LATE_CHECK_OUT_TIME : STANDARD_CHECK_OUT_TIME);
    const oldLateCheckIn = booking.lateCheckIn ?? false;
    const oldLateCheckOut = booking.lateCheckOut ?? booking.addOnIds.includes('addon_late');
    if (oldCheckInTime === checkInTime && oldCheckOutTime === checkOutTime && oldLateCheckIn === lateCheckIn && oldLateCheckOut === lateCheckOut) return 'unchanged';
    const saved = await this.repository.changeBookingStayTimes({
      bookingId: booking.id, expectedCheckIn: booking.checkIn, expectedCheckOut: booking.checkOut,
      expectedCheckInTime: oldCheckInTime, expectedCheckOutTime: oldCheckOutTime,
      expectedLateCheckIn: oldLateCheckIn, expectedLateCheckOut: oldLateCheckOut,
      checkInTime, checkOutTime, lateCheckIn, lateCheckOut,
    });
    if (saved) await this.notifyBookingChanged(reference, { kind: 'times', oldCheckInTime, oldCheckOutTime, checkInTime, checkOutTime, lateCheckIn, lateCheckOut });
    return saved ? 'ok' : 'unavailable';
  }

  /** The PMS view: every room, including hidden room types, across a window of nights. */
  async getFrontDesk(hotelSlug: string, from: string, days: number): Promise<FrontDesk> {
    const hotel = await this.catalog.getHotel(hotelSlug);
    const rooms = await this.repository.listRooms(hotel.id);
    const units = buildRoomUnits(rooms, await this.repository.listPhysicalRooms(hotel.id));
    const allBookings = await this.repository.listBookings();
    const confirmed = allBookings.filter((booking) => booking.status === 'confirmed');
    const bookingsByType = this.confirmedByRoomType(allBookings);
    const dates = Array.from({ length: days }, (_, index) => addIsoDays(from, index));
    const windowEnd = addIsoDays(from, days);

    // Only the bookings this window can draw need their payments read.
    const inWindow = confirmed.filter((booking) => booking.checkIn < windowEnd && booking.checkOut > from);
    const paidByReference = new Map(
      await Promise.all(
        inWindow.map(async (booking) => {
          const attempts = await this.repository.listPaymentAttempts(booking.id);
          const paid = attempts
            .filter((attempt) => attempt.status === 'authorized')
            .reduce((sum, attempt) => sum + attempt.amount, 0);
          return [booking.reference, paid] as const;
        }),
      ),
    );
    const byReference = new Map(allBookings.map((booking) => [booking.reference, booking]));

    const groups: FrontDeskGroup[] = await Promise.all(
      rooms.map(async (room) => {
        const roomUnits = units.filter((unit) => unit.roomTypeId === room.id).sort(byRoomNumber);
        const [{ occupancy }, ratePlans] = await Promise.all([
          this.allocate(room, roomUnits, bookingsByType.get(room.id) ?? [], dates),
          this.repository.listRatePlans(room.id),
        ]);
        const cover = coverPhoto(room);
        const context: SegmentContext = {
          dates,
          bookings: byReference,
          paid: paidByReference,
          ratePlans: new Map(ratePlans.map((plan) => [plan.id, plan])),
          defaultRatePlan: ratePlans[0] ?? null,
          capacity: room.capacity,
        };
        const displayOccupancy = scatterOutOfOrderNights(roomUnits, occupancy, dates);
        return {
          roomTypeId: room.id,
          roomName: room.name,
          roomDescription: room.description,
          roomSlug: room.slug,
          photo: cover ? { url: cover.url, width: cover.width, height: cover.height } : null,
          hidden: Boolean(room.hidden),
          rooms: roomUnits.map((unit) => ({
            number: unit.number,
            floor: unit.floor,
            facade: unit.facade,
            segments: toSegments(displayOccupancy.get(unit.number)!, unit.number, context),
          })),
        };
      }),
    );

    const summary: FrontDeskDay[] = dates.map((date, index) => ({
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

    const units = buildRoomUnits(rooms, await this.repository.listPhysicalRooms(room.hotelId)).filter(
      (unit) => unit.roomTypeId === room.id,
    );
    const bookings = this.confirmedByRoomType(await this.repository.listBookings()).get(room.id) ?? [];
    const { assignments } = await this.allocate(
      room,
      units,
      bookings,
      nightsInRange(booking.checkIn, booking.checkOut),
    );
    const today = new Date().toISOString().slice(0, 10);
    const number = booking.roomAssignments?.find(
      (assignment) => assignment.fromDate <= today && today < assignment.toDate,
    )?.roomNumber ?? [...(booking.roomAssignments ?? [])].sort((a, b) => b.fromDate.localeCompare(a.fromDate))[0]?.roomNumber ?? assignments.get(booking.reference);
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
  return a.kind !== 'booking' || (
    a.reference === (b as { reference: string }).reference &&
    a.fromDate === (b as { fromDate?: string }).fromDate &&
    a.toDate === (b as { toDate?: string }).toDate
  );
}

interface SegmentContext {
  dates: string[];
  bookings: Map<string, Booking>;
  /** Authorized payment total by booking reference. */
  paid: Map<string, number>;
  ratePlans: Map<string, RatePlan>;
  defaultRatePlan: RatePlan | null;
  capacity: number;
}

const LATE_CHECK_OUT_ADDON = 'addon_late';

// Simulated demand needs a stay's worth of detail for the desk to read like a
// PMS. Picked by hash from the room and the block's first night, so a block
// shows the same guest every time it is drawn.
const DEMAND_GUESTS = [
  'Sofia Andreou', 'Lukas Weber', 'Amelia Clarke', 'Marco Bianchi', 'Chloé Martin', 'Nikos Georgiou',
  'Emma Johansson', 'Daniel Novak', 'Isabel Ruiz', 'Oliver Bennett', 'Hanna Kowalska', 'Yusuf Demir',
];
const DEMAND_CHANNELS = [
  { name: 'Booking.com', prepaid: true },
  { name: 'Expedia', prepaid: true },
  { name: 'Phone', prepaid: false },
  { name: 'Walk-in', prepaid: false },
  { name: 'Travel agent', prepaid: true },
] as const;

function simulatedStay(
  unitNumber: string,
  checkIn: string,
  nights: number,
  context: SegmentContext,
): FrontDeskStay & { channel: string } {
  const seed = demoHash(`${unitNumber}|${checkIn}|stay`);
  const plan = context.defaultRatePlan;
  const channel = DEMAND_CHANNELS[seed % DEMAND_CHANNELS.length]!;
  const adults = Math.max(1, Math.min(context.capacity, 1 + (seed % 2)));
  const total = roundMoney(Array.from({ length: nights }, (_, index) => {
    const date = addIsoDays(checkIn, index);
    return plan?.nightlyPriceOverrides?.[date] ?? plan?.nightlyPrice ?? 0;
  }).reduce((sum, price) => sum + price, 0));
  return {
    guestName: DEMAND_GUESTS[seed % DEMAND_GUESTS.length]!,
    checkIn,
    checkOut: addIsoDays(checkIn, nights),
    adults,
    children: context.capacity > adults && seed % 5 === 0 ? 1 : 0,
    ratePlanName: plan?.name ?? 'Standard rate',
    breakfastIncluded: plan?.breakfastIncluded ?? false,
    checkInTime: STANDARD_CHECK_IN_TIME,
    checkOutTime: seed % 7 === 0 ? LATE_CHECK_OUT_TIME : STANDARD_CHECK_OUT_TIME,
    total,
    paid: channel.prepaid ? total : 0,
    currency: plan?.currency ?? 'EUR',
    channel: channel.name,
  };
}

/**
 * A room-type sale restriction can leave every physical room unavailable for
 * the entire window. Keep that availability intact, but avoid presenting the
 * whole restriction as one long maintenance event in the demo room board.
 * Two days in each four-day cycle show an out-of-order marker on one rotating
 * room; the other unavailable nights read as simulated occupancy. The cycle
 * uses absolute dates so navigating the board never moves a marker.
 */
function scatterOutOfOrderNights(
  units: RoomUnit[],
  occupancy: Map<string, Map<string, NightOccupant>>,
  dates: string[],
): Map<string, Map<string, NightOccupant>> {
  const display = new Map([...occupancy].map(([number, row]) => [number, new Map(row)]));
  if (units.length === 0) return display;
  for (const date of dates) {
    const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
    const cycleDay = ((day % 4) + 4) % 4;
    const outOfOrderRoom = cycleDay < 2 ? units[((Math.floor(day / 4) % units.length) + units.length) % units.length]!.number : null;
    for (const unit of units) {
      const row = display.get(unit.number)!;
      if (row.get(date)?.kind === 'closed' && unit.number !== outOfOrderRoom) row.set(date, { kind: 'demand' });
    }
  }
  return display;
}

function toSegments(row: Map<string, NightOccupant>, unitNumber: string, context: SegmentContext): FrontDeskSegment[] {
  const { dates, bookings } = context;
  const segments: FrontDeskSegment[] = [];
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
        const plan = context.ratePlans.get(booking.ratePlanId) ?? context.defaultRatePlan;
        segments.push({
          kind: 'booking',
          start: index,
          span: end - index,
          reference: booking.reference,
          status: booking.status,
          stayState: booking.stayState,
          guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
          guestEmail: booking.guest.email,
          guestPhone: booking.guest.phone,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          adults: booking.adults,
          children: booking.children,
          ratePlanName: plan?.name ?? 'Standard rate',
          breakfastIncluded: plan?.breakfastIncluded ?? false,
          checkInTime: booking.checkInTime ?? STANDARD_CHECK_IN_TIME,
          checkOutTime: booking.checkOutTime ?? (booking.addOnIds.includes(LATE_CHECK_OUT_ADDON) ? LATE_CHECK_OUT_TIME : STANDARD_CHECK_OUT_TIME),
          lateCheckIn: booking.lateCheckIn ?? false,
          lateCheckOut: booking.lateCheckOut ?? booking.addOnIds.includes(LATE_CHECK_OUT_ADDON),
          total: booking.total,
          paid: context.paid.get(booking.reference) ?? 0,
          currency: booking.currency,
          chosenByGuest: booking.unitNumber === unitNumber,
          continuesBefore: booking.checkIn < dates[0]! || Boolean(occupant.moveFromRoomNumber),
          continuesAfter: booking.checkOut > windowEnd || Boolean(occupant.moveToRoomNumber),
          roomFrom: occupant.fromDate ?? booking.checkIn,
          roomTo: occupant.toDate ?? booking.checkOut,
          moveFromRoomNumber: occupant.moveFromRoomNumber,
          moveToRoomNumber: occupant.moveToRoomNumber,
          moveReason: occupant.moveReason,
          movedAt: occupant.movedAt,
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
          segments.push({
            kind: 'demand',
            start: cursor,
            span: night - cursor,
            ...simulatedStay(unitNumber, dates[cursor]!, night - cursor, context),
          });
          cursor = night;
        }
      }
    }
    index = end;
  }

  return segments;
}
