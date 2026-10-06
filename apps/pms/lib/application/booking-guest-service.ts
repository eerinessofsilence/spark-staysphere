import { bookingGuestInputSchema, bookingGuestSchema, type Booking, type BookingGuest } from '../domain/schemas';
import type { BookingGuestStore, BookingStore } from '../domain/ports';

type GuestRepository = Pick<BookingStore, 'getBookingByReference'> & BookingGuestStore;

export type AddBookingGuestOutcome =
  | { outcome: 'added'; guest: BookingGuest }
  | { outcome: 'invalid' | 'not_found' | 'not_confirmed' | 'full' };

/** Names people already covered by the booked occupancy; never changes price or availability. */
export class BookingGuestService {
  constructor(
    private readonly repository: GuestRepository,
    private readonly afterGuestAdded?: (booking: Booking, guest: BookingGuest) => Promise<void>,
  ) {}

  listForBooking(booking: Booking): Promise<BookingGuest[]> {
    return this.repository.listBookingGuests(booking.id);
  }

  async add(reference: string, hotelId: string, input: unknown): Promise<AddBookingGuestOutcome> {
    const parsed = bookingGuestInputSchema.safeParse(input);
    if (!parsed.success) return { outcome: 'invalid' };
    const booking = await this.repository.getBookingByReference(reference);
    if (!booking || booking.hotelId !== hotelId) return { outcome: 'not_found' };
    if (booking.status !== 'confirmed') return { outcome: 'not_confirmed' };

    const guest = bookingGuestSchema.parse({
      ...parsed.data,
      id: crypto.randomUUID(),
      bookingId: booking.id,
      createdAt: new Date().toISOString(),
    });
    // The adapter checks category capacity in the write itself, not against
    // this earlier read: two simultaneous requests cannot fill one place twice.
    if (await this.repository.addBookingGuest(guest, hotelId)) {
      try { await this.afterGuestAdded?.(booking, guest); } catch { /* The guest stays on the booking if email delivery fails. */ }
      return { outcome: 'added', guest };
    }
    const latest = await this.repository.getBookingByReference(reference);
    if (!latest || latest.hotelId !== hotelId) return { outcome: 'not_found' };
    return { outcome: latest.status === 'confirmed' ? 'full' : 'not_confirmed' };
  }
}
