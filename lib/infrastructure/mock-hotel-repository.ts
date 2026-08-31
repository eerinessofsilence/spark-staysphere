import type { HotelRepository } from '../domain/ports';
import type { Availability, Booking } from '../domain/schemas';
import { demoAddOns, demoHotel, demoRates, demoRooms } from './mock-data';

const bookings = new Map<string, Booking>();

export const mockHotelRepository: HotelRepository = {
  async getHotel(slug) { return slug === demoHotel.slug ? demoHotel : null; },
  async listRooms(hotelId) { return demoRooms.filter((room) => room.hotelId === hotelId); },
  async listRatePlans(roomTypeId) { return demoRates.filter((rate) => rate.roomTypeId === roomTypeId); },
  async listAddOns(hotelId) { return hotelId === demoHotel.id ? demoAddOns : []; },
  async getAvailability(roomTypeId, from) {
    const index = demoRooms.findIndex((room) => room.id === roomTypeId);
    const remaining = index < 0 ? 0 : Math.max(0, 5 - index);
    const status: Availability['status'] = remaining === 0 ? 'sold_out' : remaining === 1 ? 'last_room' : remaining <= 3 ? 'limited' : 'available';
    return [{ roomTypeId, date: from, remaining, status }];
  },
  async findBookingByIdempotencyKey(key) { return bookings.get(key) ?? null; },
  async saveBooking(booking) { bookings.set(booking.idempotencyKey, booking); return booking; },
};
