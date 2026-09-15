import { addDays, format, parseISO } from 'date-fns';
import type { HotelRepository } from '../domain/ports';
import { buildPriceBreakdown, nightsBetween } from '../domain/pricing';
import {
  bookingSchema,
  type Booking,
  type Guest,
  type PaymentAttempt,
  type PaymentMethod,
  type RoomType,
} from '../domain/schemas';
import { createReference } from './booking-service';

interface SampleStay {
  /** Stable, so pressing the button twice adds nothing the second time. */
  key: string;
  /** Room type slugs, tried in order: the first on the site and free for every night wins. */
  rooms: string[];
  /** Days from today; negative is in the past. */
  checkIn: number;
  nights: number;
  adults: number;
  children?: number;
  addOnIds?: string[];
  method: PaymentMethod;
  /** Cancelled after saving — with a card that leaves money owed back, with a transfer nothing. */
  cancelled?: boolean;
  /** How many days before check-in the stay was booked. */
  leadDays: number;
  guest: Guest;
}

/**
 * A dozen stays spread across every bucket the back office sorts by: past,
 * in house, upcoming, and cancelled with and without payment, over the
 * methods a guest can pick. Nothing lands in the 45–48-day window the e2e
 * suite books into, so a demo filled with these still runs the suite.
 */
const SAMPLES: SampleStay[] = [
  {
    key: 'past-garden',
    rooms: ['garden-studio', 'cove-studio'],
    checkIn: -21,
    nights: 3,
    adults: 2,
    addOnIds: ['addon_breakfast_room'],
    method: 'card',
    leadDays: 34,
    guest: { firstName: 'Sofia', lastName: 'Andreou', email: 'sofia.andreou@example.com', phone: '+357 99 214 387' },
  },
  {
    key: 'past-coastal',
    rooms: ['coastal-twin', 'sea-view-room'],
    checkIn: -11,
    nights: 4,
    adults: 2,
    addOnIds: ['addon_transfer'],
    method: 'apple_pay',
    leadDays: 18,
    guest: { firstName: 'Jonas', lastName: 'Weber', email: 'jonas.weber@example.com', phone: '+49 151 2345 6789' },
  },
  {
    key: 'past-city',
    rooms: ['city-view-room', 'corner-suite'],
    checkIn: -6,
    nights: 2,
    adults: 1,
    method: 'card',
    leadDays: 9,
    guest: { firstName: 'Amelia', lastName: 'Hart', email: 'amelia.hart@example.com', phone: '+44 7700 900123' },
  },
  {
    key: 'inhouse-deluxe',
    rooms: ['deluxe-sea', 'sea-view-room'],
    checkIn: -2,
    nights: 5,
    adults: 2,
    addOnIds: ['addon_spa', 'addon_late'],
    method: 'google_pay',
    leadDays: 26,
    guest: { firstName: 'Marco', lastName: 'Rossi', email: 'marco.rossi@example.com', phone: '+39 347 123 4567' },
  },
  {
    key: 'inhouse-family',
    rooms: ['family-residence', 'family-loft'],
    checkIn: -1,
    nights: 4,
    adults: 2,
    children: 2,
    addOnIds: ['addon_breakfast_room'],
    method: 'pay_at_hotel',
    leadDays: 40,
    guest: { firstName: 'Eleni', lastName: 'Papadopoulou', email: 'eleni.papadopoulou@example.com', phone: '+30 694 123 4567' },
  },
  {
    key: 'upcoming-panorama',
    rooms: ['panorama-suite', 'terrace-suite'],
    checkIn: 3,
    nights: 3,
    adults: 2,
    addOnIds: ['addon_boat'],
    method: 'card',
    leadDays: 12,
    guest: { firstName: 'Liam', lastName: "O'Connor", email: 'liam.oconnor@example.com', phone: '+353 87 123 4567' },
  },
  {
    key: 'upcoming-pool',
    rooms: ['pool-terrace', 'poolside-suite'],
    checkIn: 8,
    nights: 4,
    adults: 2,
    method: 'bank_transfer',
    leadDays: 20,
    guest: { firstName: 'Nadia', lastName: 'Haddad', email: 'nadia.haddad@example.com', phone: '+961 3 123 456' },
  },
  {
    key: 'upcoming-skyline',
    rooms: ['skyline-loft', 'sky-terrace-suite'],
    checkIn: 15,
    nights: 2,
    adults: 2,
    method: 'apple_pay',
    leadDays: 6,
    guest: { firstName: 'Yuki', lastName: 'Tanaka', email: 'yuki.tanaka@example.com', phone: '+81 90 1234 5678' },
  },
  {
    key: 'upcoming-penthouse',
    rooms: ['asteria-penthouse', 'signature-suite'],
    checkIn: 27,
    nights: 5,
    adults: 4,
    addOnIds: ['addon_transfer', 'addon_terrace_dinner'],
    method: 'card',
    leadDays: 30,
    guest: { firstName: 'Charlotte', lastName: 'Dubois', email: 'charlotte.dubois@example.com', phone: '+33 6 12 34 56 78' },
  },
  {
    key: 'upcoming-residence',
    rooms: ['garden-residence', 'two-bedroom-residence'],
    checkIn: 36,
    nights: 6,
    adults: 3,
    children: 2,
    method: 'bank_transfer',
    leadDays: 45,
    guest: { firstName: 'Andreas', lastName: 'Nilsson', email: 'andreas.nilsson@example.com', phone: '+46 70 123 45 67' },
  },
  {
    key: 'cancelled-paid',
    rooms: ['deluxe-sea', 'coastal-twin'],
    checkIn: 11,
    nights: 3,
    adults: 2,
    method: 'card',
    cancelled: true,
    leadDays: 16,
    guest: { firstName: 'Hannah', lastName: 'Becker', email: 'hannah.becker@example.com', phone: '+49 170 987 6543' },
  },
  {
    key: 'cancelled-unpaid',
    rooms: ['cove-studio', 'garden-terrace-room'],
    checkIn: 19,
    nights: 2,
    adults: 1,
    method: 'bank_transfer',
    cancelled: true,
    leadDays: 10,
    guest: { firstName: 'Omar', lastName: 'Farouk', email: 'omar.farouk@example.com', phone: '+971 50 123 4567' },
  },
];

/** The methods that take the money at booking time — the same split `BookingService.confirm` makes. */
const AUTHORIZING_METHODS = new Set<PaymentMethod>(['card', 'apple_pay', 'google_pay']);

/**
 * Fills an empty demo with believable stays. It writes past and in-house
 * stays, which the guest flow rightly refuses, so it skips `confirm` and
 * saves straight through the repository — `saveBooking` still takes the
 * nights out of inventory and `cancelBooking` puts them back, so the
 * chessboard, availability and accounting all agree with what it made.
 * Money still comes from `buildPriceBreakdown`, like every other total.
 */
export class SampleBookingService {
  constructor(private readonly repository: HotelRepository) {}

  async seed(hotelSlug: string, today: string): Promise<{ created: number }> {
    const hotel = await this.repository.getHotel(hotelSlug);
    if (!hotel) return { created: 0 };

    const [rooms, addOns] = await Promise.all([
      this.repository.listRooms(hotel.id),
      this.repository.listAddOns(hotel.id),
    ]);
    const bySlug = new Map(rooms.filter((room) => !room.hidden).map((room) => [room.slug, room]));
    const base = parseISO(today);
    const day = (offset: number) => format(addDays(base, offset), 'yyyy-MM-dd');

    let created = 0;
    for (const [index, sample] of SAMPLES.entries()) {
      const idempotencyKey = `sample-${sample.key}`;
      if (await this.repository.findBookingByIdempotencyKey(idempotencyKey)) continue;

      const checkIn = day(sample.checkIn);
      const checkOut = day(sample.checkIn + sample.nights);
      const room = await this.firstFree(sample, bySlug, checkIn, checkOut);
      if (!room) continue;
      const ratePlan = (await this.repository.listRatePlans(room.id))[0];
      if (!ratePlan) continue;

      const adults = Math.max(1, Math.min(sample.adults, room.capacity));
      const children = Math.max(0, Math.min(sample.children ?? 0, room.capacity - adults));
      const chosen = addOns.filter((addOn) => addOn.enabled && sample.addOnIds?.includes(addOn.id));
      const price = buildPriceBreakdown({
        ratePlan,
        addOns: chosen,
        nights: nightsBetween(checkIn, checkOut),
        adults,
        children,
      });

      const bookedOn = day(Math.min(0, sample.checkIn - sample.leadDays));
      const hour = String(8 + (index % 11)).padStart(2, '0');
      const minute = String((index * 17) % 60).padStart(2, '0');
      const bookingId = `bkg_${crypto.randomUUID()}`;

      const booking: Booking = bookingSchema.parse({
        id: bookingId,
        reference: createReference(),
        idempotencyKey,
        hotelId: hotel.id,
        roomTypeId: room.id,
        ratePlanId: ratePlan.id,
        checkIn,
        checkOut,
        adults,
        children,
        guest: sample.guest,
        addOnIds: chosen.map((addOn) => addOn.id),
        total: price.total,
        currency: price.currency,
        status: 'confirmed',
        createdAt: `${bookedOn}T${hour}:${minute}:00.000Z`,
      } satisfies Booking);

      const attempt: PaymentAttempt = {
        id: `pay_${crypto.randomUUID()}`,
        bookingId,
        provider: sample.method,
        status: AUTHORIZING_METHODS.has(sample.method) ? 'authorized' : 'demo_pending',
        amount: price.total,
        currency: price.currency,
      };

      await this.repository.savePaymentAttempt(attempt);
      await this.repository.saveBooking(booking);
      if (sample.cancelled) await this.repository.cancelBooking(booking.reference);
      created += 1;
    }

    return { created };
  }

  /**
   * The named rooms first, then any room on the site that sleeps the party,
   * smallest first: simulated demand can fill both named rooms on a given
   * night, and a sample placed in a neighbouring room beats one dropped.
   */
  private async firstFree(
    sample: SampleStay,
    bySlug: Map<string, RoomType>,
    checkIn: string,
    checkOut: string,
  ): Promise<RoomType | null> {
    const party = sample.adults + (sample.children ?? 0);
    const preferred = sample.rooms
      .map((slug) => bySlug.get(slug))
      .filter((room): room is RoomType => Boolean(room));
    const others = [...bySlug.values()]
      .filter((room) => !sample.rooms.includes(room.slug) && room.capacity >= party)
      .sort((a, b) => a.capacity - b.capacity);

    for (const room of [...preferred, ...others]) {
      const nights = await this.repository.getAvailability(room.id, checkIn, checkOut);
      if (nights.length > 0 && nights.every((night) => night.remaining > 0)) return room;
    }
    return null;
  }
}
