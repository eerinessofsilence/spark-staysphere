import type {
  Clock,
  GeneratedReport,
  GeneratedReportRow,
  GeneratedReportStore,
  GeneratedRoomTypeRow,
  GeneratedStatisticsRow,
  HotelRepository,
  ReportPeriodView,
  ReportType,
} from '../domain/ports';
import type { Booking, Currency, HousekeepingStatus } from '../domain/schemas';
import type { CatalogService } from './catalog-service';
import type { HousekeepingService } from './housekeeping-service';
import type { InventoryService } from './inventory-service';

/** Live report row, derived from the booking and the hotel's current catalog. */
export interface PeriodReportRow extends GeneratedReportRow {
  breakfastGuests: number;
  diningItems: string[];
}

export type RoomTypeReportRow = GeneratedRoomTypeRow;

export interface PeriodReport {
  rows: PeriodReportRow[];
  roomTypes: RoomTypeReportRow[];
}

/** One physical room next to whoever is in it, for the "Statistics" view — live or frozen, the same shape either way. */
export interface StatisticsRow {
  id: string;
  roomNumber: string | null;
  booking: PeriodReportRow | null;
  status: HousekeepingStatus | null;
  note: string | null;
}

function overlapNights(checkIn: string, checkOut: string, from: string, to: string): number {
  const start = Math.max(Date.parse(`${checkIn}T00:00:00Z`), Date.parse(`${from}T00:00:00Z`));
  // A stay ends at checkout; a report includes its final selected day.
  const end = Math.min(Date.parse(`${checkOut}T00:00:00Z`), Date.parse(`${to}T00:00:00Z`) + 86_400_000);
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

function matchesReport(booking: Booking, type: ReportType, date: string): boolean {
  if (booking.status === 'cancelled') return false;
  switch (type) {
    case 'arrivals':
      return booking.checkIn === date;
    case 'departures':
      return booking.checkOut === date;
    case 'in_house':
      return booking.checkIn <= date && date < booking.checkOut;
  }
}

/**
 * `/admin/accounting/reports`' two tabs share one query — arrivals,
 * departures or in-house for a hotel and a date — but differ in what
 * happens to the result: "Online" just returns it, "Generated" freezes it
 * into a `GeneratedReport` the store keeps, so a report stays what it said
 * when it was handed to someone even after later bookings or cancellations.
 */
export class ReportsService {
  constructor(
    private readonly store: GeneratedReportStore,
    private readonly repository: Pick<HotelRepository, 'listBookings' | 'listRooms' | 'listPhysicalRooms' | 'listRatePlans' | 'listAddOns'>,
    private readonly catalog: Pick<CatalogService, 'getHotel'>,
    private readonly inventory: Pick<InventoryService, 'getBookingRoom'>,
    private readonly housekeeping: Pick<HousekeepingService, 'listRooms'>,
    private readonly clock: Clock,
  ) {}

  /** The live query behind the "Online" tab — never persisted. */
  async query(hotelSlug: string, type: ReportType, date: string): Promise<GeneratedReportRow[]> {
    const hotel = await this.catalog.getHotel(hotelSlug);
    const [allBookings, rooms] = await Promise.all([this.repository.listBookings(), this.repository.listRooms(hotel.id)]);
    const roomNames = new Map(rooms.map((room) => [room.id, room.name]));
    const matches = allBookings
      .filter((booking) => booking.hotelId === hotel.id)
      .filter((booking) => matchesReport(booking, type, date))
      .sort((a, b) => a.guest.lastName.localeCompare(b.guest.lastName));

    return Promise.all(
      matches.map(async (booking) => {
        const room = await this.inventory.getBookingRoom(booking);
        const row: GeneratedReportRow = {
          bookingId: booking.id,
          reference: booking.reference,
          guestFirstName: booking.guest.firstName,
          guestLastName: booking.guest.lastName,
          guestEmail: booking.guest.email,
          roomTypeName: roomNames.get(booking.roomTypeId) ?? booking.roomTypeId,
          roomNumber: room?.number ?? null,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          adults: booking.adults,
          children: booking.children,
          total: booking.total,
          currency: booking.currency,
        };
        return row;
      }),
    );
  }

  /** Current operational reports for an inclusive date range. No sample numbers are inserted. */
  async queryPeriod(hotelSlug: string, from: string, to: string): Promise<PeriodReport> {
    const hotel = await this.catalog.getHotel(hotelSlug);
    const [allBookings, roomTypes, physicalRooms, addOns] = await Promise.all([
      this.repository.listBookings(),
      this.repository.listRooms(hotel.id),
      this.repository.listPhysicalRooms(hotel.id),
      this.repository.listAddOns(hotel.id),
    ]);
    const ratePlanLists = await Promise.all(roomTypes.map((room) => this.repository.listRatePlans(room.id)));
    const rates = new Map(ratePlanLists.flat().map((rate) => [rate.id, rate]));
    const dining = new Map(addOns.filter((addOn) => addOn.category === 'dining').map((addOn) => [addOn.id, addOn.name]));
    const roomNames = new Map(roomTypes.map((room) => [room.id, room.name]));
    const periodDays = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
    const summaries = new Map(roomTypes.map((room) => [room.id, {
      id: room.id,
      name: room.name,
      rooms: physicalRooms.filter((unit) => unit.roomTypeId === room.id).length,
      occupiedNights: 0,
      availableNights: physicalRooms.filter((unit) => unit.roomTypeId === room.id).length * periodDays,
      bookingValues: {} as Partial<Record<Currency, number>>,
    }]));

    const bookings = allBookings.filter((booking) =>
      booking.hotelId === hotel.id && booking.status === 'confirmed' && overlapNights(booking.checkIn, booking.checkOut, from, to) > 0,
    );
    const rows = await Promise.all(bookings.map(async (booking): Promise<PeriodReportRow> => {
      const room = await this.inventory.getBookingRoom(booking);
      const nights = overlapNights(booking.checkIn, booking.checkOut, from, to);
      const summary = summaries.get(booking.roomTypeId);
      if (summary) {
        summary.occupiedNights += nights;
        // A booking's total is the full stay amount, shown as such rather than apportioned per night.
        summary.bookingValues[booking.currency] = (summary.bookingValues[booking.currency] ?? 0) + booking.total;
      }
      return {
        bookingId: booking.id,
        reference: booking.reference,
        guestFirstName: booking.guest.firstName,
        guestLastName: booking.guest.lastName,
        guestEmail: booking.guest.email,
        roomTypeName: roomNames.get(booking.roomTypeId) ?? booking.roomTypeId,
        roomNumber: room?.number ?? booking.unitNumber ?? null,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        adults: booking.adults,
        children: booking.children,
        total: booking.total,
        currency: booking.currency,
        breakfastGuests: rates.get(booking.ratePlanId)?.breakfastIncluded ? booking.adults + booking.children : 0,
        diningItems: booking.addOnIds.flatMap((id) => dining.has(id) ? [dining.get(id)!] : []),
      };
    }));
    rows.sort((a, b) => (a.roomNumber ?? '').localeCompare(b.roomNumber ?? '', undefined, { numeric: true }) || a.checkIn.localeCompare(b.checkIn));
    return { rows, roomTypes: [...summaries.values()].sort((a, b) => a.name.localeCompare(b.name)) };
  }

  /**
   * "Statistics"' own join, shared by the live "Online" view and its frozen
   * snapshot (`generatePeriod`): every physical room next to whoever is in
   * it this period, plus any booking whose room `queryPeriod` could name but
   * housekeeping doesn't track (a room since removed from the catalog).
   */
  async queryStatistics(hotelSlug: string, from: string, to: string, today: string): Promise<StatisticsRow[]> {
    const [periodReport, housekeepingRooms] = await Promise.all([
      this.queryPeriod(hotelSlug, from, to),
      this.housekeeping.listRooms(hotelSlug, today),
    ]);
    const bookingsByRoom = new Map<string, PeriodReportRow[]>();
    for (const booking of periodReport.rows) {
      if (!booking.roomNumber) continue;
      const current = bookingsByRoom.get(booking.roomNumber) ?? [];
      current.push(booking);
      bookingsByRoom.set(booking.roomNumber, current);
    }
    const knownRooms = new Set(housekeepingRooms.map((room) => room.unit.number));
    const rows: StatisticsRow[] = [
      ...housekeepingRooms.flatMap((room): StatisticsRow[] => {
        const bookings = bookingsByRoom.get(room.unit.number) ?? [];
        const current = { roomNumber: room.unit.number, status: room.status, note: room.note };
        return bookings.length
          ? bookings.map((booking) => ({ id: booking.bookingId, booking, ...current }))
          : [{ id: room.unit.id, booking: null, ...current }];
      }),
      ...periodReport.rows
        .filter((booking) => !booking.roomNumber || !knownRooms.has(booking.roomNumber))
        .map((booking): StatisticsRow => ({ id: booking.bookingId, roomNumber: booking.roomNumber, booking, status: null, note: null })),
    ];
    rows.sort((a, b) => (a.roomNumber ?? '').localeCompare(b.roomNumber ?? '', undefined, { numeric: true }));
    return rows;
  }

  /** Runs `query` and freezes the result as a new row in the "Generated" tab's grid. */
  async generate(hotelSlug: string, type: ReportType, date: string, generatedBy: string): Promise<GeneratedReport> {
    const hotel = await this.catalog.getHotel(hotelSlug);
    const rows = await this.query(hotelSlug, type, date);
    const report: GeneratedReport = {
      id: `report_${crypto.randomUUID()}`,
      hotelId: hotel.id,
      type,
      date,
      generatedAt: this.clock.now().toISOString(),
      generatedBy,
      rows,
    };
    await this.store.save(report);
    return report;
  }

  /**
   * `generate`'s counterpart for the four period views: runs `queryPeriod`
   * (or, for "Statistics", `queryStatistics`) and freezes the result —
   * "Manager analytics" as `roomTypeRows`, "Statistics" as `statisticsRows`,
   * "Financial"/"Guest ledger" as the same `rows` a daily report uses.
   */
  async generatePeriod(
    hotelSlug: string,
    view: ReportPeriodView,
    from: string,
    to: string,
    today: string,
    generatedBy: string,
  ): Promise<GeneratedReport> {
    const hotel = await this.catalog.getHotel(hotelSlug);
    const base = {
      id: `report_${crypto.randomUUID()}`,
      hotelId: hotel.id,
      type: view,
      date: from,
      to,
      generatedAt: this.clock.now().toISOString(),
      generatedBy,
    };
    let report: GeneratedReport;
    if (view === 'manager') {
      const { roomTypes } = await this.queryPeriod(hotelSlug, from, to);
      report = { ...base, rows: [], roomTypeRows: roomTypes };
    } else if (view === 'statistics') {
      const statisticsRows: GeneratedStatisticsRow[] = (await this.queryStatistics(hotelSlug, from, to, today)).map((row) => ({
        id: row.id,
        roomNumber: row.roomNumber,
        booking: row.booking,
        housekeepingStatus: row.status,
        note: row.note,
      }));
      report = { ...base, rows: [], statisticsRows };
    } else {
      const { rows } = await this.queryPeriod(hotelSlug, from, to);
      report = { ...base, rows };
    }
    await this.store.save(report);
    return report;
  }

  async list(hotelSlug: string): Promise<GeneratedReport[]> {
    const hotel = await this.catalog.getHotel(hotelSlug);
    return this.store.list(hotel.id);
  }

  /**
   * Fills an empty "Generated" tab with one of each report type for today —
   * the same demo convenience `SampleBookingsButton` gives the ledger.
   * Stable per type+date, like the sample bookings' own keys, so pressing
   * it again adds nothing once today's three already exist.
   */
  async generateSamples(hotelSlug: string, today: string, generatedBy: string): Promise<{ created: number }> {
    const existing = await this.list(hotelSlug);
    let created = 0;
    for (const type of ['arrivals', 'departures', 'in_house'] as const) {
      if (existing.some((report) => report.type === type && report.date === today)) continue;
      await this.generate(hotelSlug, type, today, generatedBy);
      created += 1;
    }
    return { created };
  }

  async get(hotelSlug: string, id: string): Promise<GeneratedReport | null> {
    const hotel = await this.catalog.getHotel(hotelSlug);
    const report = await this.store.get(hotel.id, id);
    return report && report.hotelId === hotel.id ? report : null;
  }
}
