import { z } from 'zod';
import type {
  BookingEngineAdapter,
  BookingStore,
  CatalogReader,
  Clock,
  CrmAdapter,
  PaymentAttemptStore,
  PaymentProvider,
  PmsAdapter,
  QuoteRequest,
} from '../domain/ports';
import type {
  AddOn,
  Booking,
  BookingRequest,
  Currency,
  PaymentAttempt,
  PaymentMethod,
  Quote,
  RatePlan,
  RoomType,
  StayState,
} from '../domain/schemas';
import { bookingRequestSchema, bookingSchema } from '../domain/schemas';
import { matchesGuestEmail } from '../domain/booking';
import { canTransitionStay } from '../domain/stay-state';
import { systemClock } from '../domain/clock';
import { nightsBetween } from '../domain/pricing';
import { coverPhoto } from '../domain/room-attributes';

export type BookingErrorCode =
  | 'invalid_request'
  | 'unavailable'
  | 'price_changed'
  | 'payment_declined'
  | 'not_found';

/** A failure the guest-facing flow is expected to render, not a crash. */
export class BookingError extends Error {
  constructor(
    readonly code: BookingErrorCode,
    message: string,
    readonly details?: { currentTotal?: number; fieldErrors?: Record<string, string[]> },
  ) {
    super(message);
    this.name = 'BookingError';
  }
}

export interface BookingConfirmation {
  booking: Booking;
  room: RoomType | null;
  ratePlan: RatePlan | null;
  addOns: AddOn[];
  payments: PaymentAttempt[];
}

/**
 * One stay as "My trips" lists it: enough to recognise the booking and open
 * it, and deliberately not the whole `Booking` — the guest's own details and
 * the payment attempts stay on the confirmation page, behind the reference.
 */
export interface TripSummary {
  reference: string;
  roomName: string;
  roomSlug: string | null;
  photo: { url: string; width?: number; height?: number } | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  addOnCount: number;
  total: number;
  currency: Currency;
  status: Booking['status'];
  /** False once the stay has started, and for a booking already cancelled. */
  canCancel: boolean;
  createdAt: string;
}

export type CancelOutcome = 'cancelled' | 'already_cancelled' | 'stay_started' | 'not_found';
export type StayStateOutcome = 'updated' | 'not_allowed' | 'booking_cancelled' | 'not_found';

/** The methods that take the money at booking time rather than later — exported so the front
 *  desk's own booking form can preview which outcome a payment method choice will produce,
 *  without a second, driftable copy of the same set. */
export const AUTHORIZING_METHODS = new Set<PaymentMethod>(['card', 'apple_pay', 'google_pay']);

/** A browser can remember a long history; a page does not need to load all of it. */
const MAX_TRIPS = 40;

/** References are shown and typed in upper case, whatever the keyboard did. */
function normalizeReference(reference: string): string {
  return reference.trim().toUpperCase();
}

const REFERENCE_ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY3456789';

/**
 * A 6-character code, not the AC-prefixed one this product used to hand
 * out: a guest already treats a booking reference like an airline PNR, and
 * the shorter one reads as one glance rather than something to copy
 * carefully.
 */
export function createReference(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let reference = '';
  for (const byte of bytes) reference += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length];
  return reference;
}

export class BookingService {
  constructor(
    private readonly repository: Pick<CatalogReader, 'listAddOns' | 'listRatePlans' | 'listRooms' | 'listPhysicalRooms'> &
      BookingStore &
      PaymentAttemptStore,
    private readonly bookingEngine: BookingEngineAdapter,
    private readonly paymentProvider: PaymentProvider,
    private readonly crm?: CrmAdapter,
    private readonly pms?: PmsAdapter,
    private readonly clock: Clock = systemClock,
    private readonly afterCheckout?: (booking: Booking) => Promise<void>,
    private readonly afterConfirm?: (booking: Booking) => Promise<void>,
    private readonly afterCancel?: (booking: Booking) => Promise<void>,
  ) {}

  /**
   * Whether the stay is still ahead. Compared as calendar dates, in the
   * server's own day: a guest arriving today is checking in, not booking, and
   * either way this is a demo whose property sits in one timezone.
   */
  private isBeforeCheckIn(checkIn: string): boolean {
    const today = this.clock.now();
    const offset = today.getTimezoneOffset();
    return checkIn > new Date(today.getTime() - offset * 60_000).toISOString().slice(0, 10);
  }

  /** Server-authoritative price and availability. The UI never computes a total itself. */
  async quote(request: QuoteRequest): Promise<Quote> {
    return this.bookingEngine.quote(request);
  }

  async getByReference(reference: string): Promise<Booking> {
    const booking = await this.repository.getBookingByReference(normalizeReference(reference));
    if (!booking) throw new BookingError('not_found', `No booking found for ${reference}.`);
    return booking;
  }

  /** Everything the confirmation page needs, resolved through the repository port. */
  async getConfirmation(reference: string): Promise<BookingConfirmation> {
    const booking = await this.getByReference(reference);
    const rooms = await this.repository.listRooms(booking.hotelId);
    const room = rooms.find((candidate) => candidate.id === booking.roomTypeId) ?? null;
    const ratePlans = room ? await this.repository.listRatePlans(room.id) : [];
    const allAddOns = await this.repository.listAddOns(booking.hotelId);

    return {
      booking,
      room,
      ratePlan: ratePlans.find((plan) => plan.id === booking.ratePlanId) ?? null,
      addOns: allAddOns.filter((addOn) => booking.addOnIds.includes(addOn.id)),
      payments: await this.repository.listPaymentAttempts(booking.id),
    };
  }

  /**
   * The stays behind a list of references, newest arrival last and unknown
   * references simply dropped: a browser that remembers a booking the server
   * has since forgotten (this demo holds them per process) should show the
   * trips it still has, not an error.
   */
  async listTrips(references: string[]): Promise<TripSummary[]> {
    const unique = [...new Set(references.map(normalizeReference).filter(Boolean))].slice(
      0,
      MAX_TRIPS,
    );
    const found = await Promise.all(
      unique.map((reference) => this.repository.getBookingByReference(reference)),
    );
    const bookings = found.filter((booking): booking is Booking => booking !== null);

    // One room read per hotel rather than per booking: every trip in this demo
    // is at the same property, and a guest's list is mostly one hotel anyway.
    const roomsByHotel = new Map<string, RoomType[]>();
    for (const hotelId of new Set(bookings.map((booking) => booking.hotelId))) {
      roomsByHotel.set(hotelId, await this.repository.listRooms(hotelId));
    }

    return bookings
      .map((booking) =>
        this.summarize(
          booking,
          roomsByHotel.get(booking.hotelId)?.find((room) => room.id === booking.roomTypeId) ?? null,
        ),
      )
      .sort((first, second) => first.checkIn.localeCompare(second.checkIn));
  }

  /**
   * A trip claimed on a device that never made it. The reference alone is not
   * the key — the email it was booked with has to match too, so the form
   * cannot be walked through the reference space to read a stranger's stay.
   * A wrong email and a reference that was never issued fail identically, or
   * the failure itself would say which references exist.
   */
  async findTrip(reference: string, email: string): Promise<TripSummary | null> {
    const booking = await this.repository.getBookingByReference(normalizeReference(reference));
    if (!booking) return null;
    if (!matchesGuestEmail(booking.guest.email, email)) return null;

    const rooms = await this.repository.listRooms(booking.hotelId);
    return this.summarize(booking, rooms.find((room) => room.id === booking.roomTypeId) ?? null);
  }

  /**
   * Cancels a stay for the guest who booked it.
   *
   * Same key as `findTrip`: the reference alone opens nothing, and a wrong
   * email is indistinguishable from a reference that was never issued. A
   * stay that has already begun is not a cancellation — the desk handles an
   * early departure, not this form — so it is refused rather than quietly
   * releasing a room somebody is currently in.
   */
  async cancelTrip(
    reference: string,
    email: string,
  ): Promise<{ outcome: CancelOutcome; trip?: TripSummary }> {
    const booking = await this.repository.getBookingByReference(normalizeReference(reference));
    if (!booking) return { outcome: 'not_found' };
    if (!matchesGuestEmail(booking.guest.email, email)) {
      return { outcome: 'not_found' };
    }

    const rooms = await this.repository.listRooms(booking.hotelId);
    const room = rooms.find((candidate) => candidate.id === booking.roomTypeId) ?? null;

    if (booking.status === 'cancelled') {
      return { outcome: 'already_cancelled', trip: this.summarize(booking, room) };
    }
    if (!this.isBeforeCheckIn(booking.checkIn)) {
      return { outcome: 'stay_started', trip: this.summarize(booking, room) };
    }

    const cancelled = await this.repository.cancelBooking(booking.reference);
    if (!cancelled) return { outcome: 'not_found' };
    try { await this.afterCancel?.(cancelled); } catch { /* Best-effort, same as notifyDownstream. */ }
    return { outcome: 'cancelled', trip: this.summarize(cancelled, room) };
  }

  async findByIdempotencyKey(key: string): Promise<Booking | null> {
    return this.repository.findBookingByIdempotencyKey(key);
  }

  /**
   * The desk logging money that moved outside the guest's own checkout —
   * a card run through a POS terminal, cash at the desk, a bank transfer
   * that landed. Adds an authorized attempt rather than touching the
   * booking's own total, the same ledger every other payment lands in
   * (`buildLedger` picks it up from `listPaymentAttempts` next read).
   */
  async recordManualPayment(
    reference: string,
    provider: string,
    amount: number,
  ): Promise<{ outcome: 'recorded' | 'not_found' | 'cancelled' | 'invalid_amount'; booking?: Booking }> {
    const booking = await this.repository.getBookingByReference(normalizeReference(reference));
    if (!booking) return { outcome: 'not_found' };
    if (booking.status === 'cancelled') return { outcome: 'cancelled', booking };
    if (!Number.isFinite(amount) || amount <= 0) return { outcome: 'invalid_amount', booking };
    const attempt: PaymentAttempt = {
      id: `pay_${crypto.randomUUID()}`,
      bookingId: booking.id,
      provider,
      status: 'authorized',
      amount: Math.round(amount * 100) / 100,
      currency: booking.currency,
    };
    await this.repository.savePaymentAttempt(attempt);
    return { outcome: 'recorded', booking };
  }

  /** The hotel cancelling: no email check, but a stay already under way is still the desk's call. */
  async cancelAsHotel(reference: string): Promise<{ outcome: CancelOutcome; booking?: Booking }> {
    const booking = await this.repository.getBookingByReference(normalizeReference(reference));
    if (!booking) return { outcome: 'not_found' };
    if (booking.status === 'cancelled') return { outcome: 'already_cancelled', booking };
    if (!this.isBeforeCheckIn(booking.checkIn)) return { outcome: 'stay_started', booking };
    const cancelled = await this.repository.cancelBooking(booking.reference);
    if (cancelled) {
      try { await this.afterCancel?.(cancelled); } catch { /* Best-effort, same as notifyDownstream. */ }
    }
    return cancelled ? { outcome: 'cancelled', booking: cancelled } : { outcome: 'not_found' };
  }

  /**
   * The desk checking a guest in or out, or marking a no-show. Only the
   * moves in `STAY_TRANSITIONS` are allowed, and never on a cancelled
   * booking — that has no stay left to move. Dates are deliberately not a
   * rule here: an early arrival or a late departure is the desk's call.
   */
  async setStayStateAsHotel(
    reference: string,
    state: StayState,
  ): Promise<{ outcome: StayStateOutcome; booking?: Booking }> {
    const booking = await this.repository.getBookingByReference(normalizeReference(reference));
    if (!booking) return { outcome: 'not_found' };
    if (booking.status === 'cancelled') return { outcome: 'booking_cancelled', booking };
    if (!canTransitionStay(booking.stayState, state)) return { outcome: 'not_allowed', booking };
    const updated = await this.repository.setBookingStayState(booking.reference, state);
    if (updated && state === 'checked_out') {
      try { await this.afterCheckout?.(updated); } catch { /* The persisted checkout is retried by the document worker. */ }
    }
    return updated ? { outcome: 'updated', booking: updated } : { outcome: 'not_found' };
  }

  private summarize(booking: Booking, room: RoomType | null): TripSummary {
    const photo = room ? (coverPhoto(room) ?? null) : null;
    return {
      reference: booking.reference,
      roomName: room?.name ?? 'Your room',
      roomSlug: room?.slug ?? null,
      photo: photo ? { url: photo.url, width: photo.width, height: photo.height } : null,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      nights: nightsBetween(booking.checkIn, booking.checkOut),
      adults: booking.adults,
      children: booking.children,
      addOnCount: booking.addOnIds.length,
      total: booking.total,
      currency: booking.currency,
      status: booking.status,
      canCancel: booking.status !== 'cancelled' && this.isBeforeCheckIn(booking.checkIn),
      createdAt: booking.createdAt,
    };
  }

  /**
   * Idempotency → live price/availability recheck → hold → demo authorization →
   * persistence → downstream notification. Replaying the same idempotency key
   * returns the original booking instead of charging or holding twice.
   */
  async confirm(request: BookingRequest): Promise<Booking> {
    const parsed = bookingRequestSchema.safeParse(request);
    if (!parsed.success) {
      throw new BookingError('invalid_request', 'The booking request is incomplete.', {
        fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      });
    }
    const input = parsed.data;

    const existing = await this.repository.findBookingByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;

    const quote = await this.bookingEngine.quote({
      roomTypeId: input.roomTypeId,
      ratePlanId: input.ratePlanId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: input.children,
      addOnIds: input.addOnIds,
    });

    if (!quote.available) {
      throw new BookingError(
        'unavailable',
        'That room is no longer available for those dates. Choose another room or shift your stay.',
      );
    }
    if (quote.price.total !== input.expectedTotal) {
      throw new BookingError(
        'price_changed',
        'The price for this stay changed while you were booking. Review the new total before confirming.',
        { currentTotal: quote.price.total },
      );
    }

    await this.bookingEngine.hold({
      roomTypeId: input.roomTypeId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
    });

    const bookingId = `bkg_${crypto.randomUUID()}`;

    // A transfer and paying at the desk take nothing now — the stay is
    // guaranteed and the money arrives later — so they record an attempt that
    // is still pending rather than claiming an authorization that never
    // happened. Only the card and the wallets go to the provider.
    const authorizesNow = AUTHORIZING_METHODS.has(input.paymentMethod);
    const payment = authorizesNow
      ? await this.paymentProvider.authorizeDemo({
          bookingId,
          amount: quote.price.total,
          currency: quote.price.currency,
        })
      : null;

    const attempt: PaymentAttempt = {
      id: payment?.paymentAttemptId ?? `pay_${crypto.randomUUID()}`,
      bookingId,
      provider: input.paymentMethod,
      status: payment ? (payment.authorized ? 'authorized' : 'failed') : 'demo_pending',
      amount: quote.price.total,
      currency: quote.price.currency,
    };
    if (payment && !payment.authorized) {
      throw new BookingError(
        'payment_declined',
        payment.declineReason ?? 'The demo payment was not authorized.',
      );
    }

    const booking = bookingSchema.parse({
      id: bookingId,
      reference: createReference(),
      idempotencyKey: input.idempotencyKey,
      hotelId: input.hotelId,
      roomTypeId: input.roomTypeId,
      ratePlanId: quote.ratePlanId || input.ratePlanId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: input.children,
      guest: input.guest,
      addOnIds: quote.addOnIds,
      unitNumber: input.unitNumber,
      total: quote.price.total,
      currency: quote.price.currency,
      status: 'confirmed',
      stayState: 'booked',
      createdAt: new Date().toISOString(),
    } satisfies Booking);

    let saved: Booking;
    try {
      const units = await this.repository.listPhysicalRooms(input.hotelId);
      const inventoryCapacity = units.filter((unit) => unit.roomTypeId === input.roomTypeId).length;
      saved = await this.repository.saveBooking(booking, inventoryCapacity);
    } catch (error) {
      if (error instanceof Error && error.name === 'BookingInventoryConflictError') {
        throw new BookingError(
          'unavailable',
          'That room is no longer available for those dates. Choose another room or shift your stay.',
        );
      }
      throw error;
    }
    // Only persist the attempt after the booking won its idempotency race.
    // The deterministic id makes concurrent replays one ledger row.
    await this.repository.savePaymentAttempt({
      ...attempt,
      id: `pay_${saved.id}`,
      bookingId: saved.id,
    });
    await this.notifyDownstream(saved);
    try { await this.afterConfirm?.(saved); } catch { /* Best-effort, same as notifyDownstream. */ }
    return saved;
  }

  /**
   * CRM and PMS delivery is best-effort: a confirmed, paid booking must not be
   * lost because a downstream system is unreachable. Production retries these
   * from a queue instead of swallowing the failure.
   */
  private async notifyDownstream(booking: Booking): Promise<void> {
    try {
      await this.crm?.upsertGuest(booking.guest);
      await this.crm?.trackBooking(booking);
      await this.pms?.pushReservation(booking);
    } catch {
      // Intentionally ignored in the demo; see TECH.md "Current limitations".
    }
  }
}
