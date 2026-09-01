import { z } from 'zod';
import type {
  BookingEngineAdapter,
  CrmAdapter,
  HotelRepository,
  PaymentProvider,
  PmsAdapter,
  QuoteRequest,
} from '../domain/ports';
import type {
  AddOn,
  Booking,
  BookingRequest,
  PaymentAttempt,
  Quote,
  RatePlan,
  RoomType,
} from '../domain/schemas';
import { bookingRequestSchema, bookingSchema } from '../domain/schemas';

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

const REFERENCE_ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY3456789';

function createReference(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let reference = '';
  for (const byte of bytes) reference += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length];
  return `AC-${reference}`;
}

export class BookingService {
  constructor(
    private readonly repository: HotelRepository,
    private readonly bookingEngine: BookingEngineAdapter,
    private readonly paymentProvider: PaymentProvider,
    private readonly crm?: CrmAdapter,
    private readonly pms?: PmsAdapter,
  ) {}

  /** Server-authoritative price and availability. The UI never computes a total itself. */
  async quote(request: QuoteRequest): Promise<Quote> {
    return this.bookingEngine.quote(request);
  }

  async getByReference(reference: string): Promise<Booking> {
    const booking = await this.repository.getBookingByReference(reference);
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
    const payment = await this.paymentProvider.authorizeDemo({
      bookingId,
      amount: quote.price.total,
      currency: quote.price.currency,
    });

    const attempt: PaymentAttempt = {
      id: payment.paymentAttemptId,
      bookingId,
      provider: 'demo',
      status: payment.authorized ? 'authorized' : 'failed',
      amount: quote.price.total,
      currency: quote.price.currency,
    };
    await this.repository.savePaymentAttempt(attempt);

    if (!payment.authorized) {
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
      total: quote.price.total,
      currency: quote.price.currency,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    } satisfies Booking);

    const saved = await this.repository.saveBooking(booking);
    await this.notifyDownstream(saved);
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
