import type { Booking } from '../domain/schemas';
import { bookingSchema } from '../domain/schemas';
import type { BookingEngineAdapter, HotelRepository, PaymentProvider } from '../domain/ports';

export class BookingService {
  constructor(
    private readonly repository: HotelRepository,
    private readonly bookingEngine: BookingEngineAdapter,
    private readonly paymentProvider: PaymentProvider,
  ) {}

  async confirm(candidate: Booking): Promise<Booking> {
    const input = bookingSchema.parse(candidate);
    const existing = await this.repository.findBookingByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;

    const quote = await this.bookingEngine.quote({
      roomTypeId: input.roomTypeId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guests: input.adults + input.children,
    });
    if (!quote.available || quote.total !== input.total) {
      throw new Error('Availability or price changed. Request a fresh quote.');
    }

    await this.bookingEngine.hold({
      roomTypeId: input.roomTypeId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
    });
    const payment = await this.paymentProvider.authorizeDemo({
      bookingId: input.id,
      amount: input.total,
      currency: input.currency,
    });
    if (!payment.authorized) throw new Error('Demo payment was not authorized.');

    return this.repository.saveBooking({ ...input, status: 'confirmed' });
  }
}
