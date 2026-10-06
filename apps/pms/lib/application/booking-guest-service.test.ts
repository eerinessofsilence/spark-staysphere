import { describe, expect, it } from 'vitest';
import { bookingSchema, type BookingGuest } from '../domain/schemas';
import { BookingGuestService } from './booking-guest-service';

const booking = bookingSchema.parse({
  id: 'reservation-1', reference: 'ABC123', idempotencyKey: 'guest-test', hotelId: 'hotel-1',
  roomTypeId: 'room-1', ratePlanId: 'rate-1', checkIn: '2026-12-10', checkOut: '2026-12-12',
  adults: 2, children: 1,
  guest: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: '123456789' },
  addOnIds: [], total: 200, currency: 'EUR', status: 'confirmed', createdAt: '2026-10-01T00:00:00.000Z',
});

function setup(current = booking) {
  const guests: BookingGuest[] = [];
  const service = new BookingGuestService({
    async getBookingByReference(reference) { return reference === current.reference ? current : null; },
    async listBookingGuests(bookingId) { return guests.filter((guest) => guest.bookingId === bookingId); },
    async addBookingGuest(guest, hotelId) {
      if (current.hotelId !== hotelId || current.status !== 'confirmed') return false;
      const capacity = guest.category === 'adult' ? current.adults - 1 : current.children;
      if (guests.filter((item) => item.category === guest.category).length >= capacity) return false;
      guests.push(guest);
      return true;
    },
  });
  return { service, guests };
}

describe('BookingGuestService', () => {
  it('names only the places already in the reservation', async () => {
    const { service, guests } = setup();
    expect((await service.add('ABC123', 'hotel-1', { category: 'adult', firstName: 'Grace', lastName: 'Hopper' })).outcome).toBe('added');
    expect((await service.add('ABC123', 'hotel-1', { category: 'adult', firstName: 'Marie', lastName: 'Curie' })).outcome).toBe('full');
    expect((await service.add('ABC123', 'hotel-1', { category: 'child', firstName: 'Sam', lastName: 'Lovelace' })).outcome).toBe('added');
    expect(guests).toHaveLength(2);
    expect(await service.listForBooking(booking)).toEqual(guests);
    expect(booking.adults).toBe(2);
    expect(booking.children).toBe(1);
  });

  it('rejects another hotel, a cancelled booking and invalid names', async () => {
    const { service } = setup();
    expect((await service.add('ABC123', 'hotel-2', { category: 'adult', firstName: 'Grace', lastName: 'Hopper' })).outcome).toBe('not_found');
    expect((await service.add('ABC123', 'hotel-1', { category: 'adult', firstName: ' ', lastName: 'Hopper' })).outcome).toBe('invalid');
    const cancelled = setup({ ...booking, status: 'cancelled' });
    expect((await cancelled.service.add('ABC123', 'hotel-1', { category: 'adult', firstName: 'Grace', lastName: 'Hopper' })).outcome).toBe('not_confirmed');
  });
});
