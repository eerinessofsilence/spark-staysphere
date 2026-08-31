import type { AddOn, Availability, Booking, Guest, Hotel, RatePlan, RoomType } from './schemas';

export interface HotelRepository {
  getHotel(slug: string): Promise<Hotel | null>;
  listRooms(hotelId: string): Promise<RoomType[]>;
  listRatePlans(roomTypeId: string): Promise<RatePlan[]>;
  listAddOns(hotelId: string): Promise<AddOn[]>;
  getAvailability(roomTypeId: string, from: string, to: string): Promise<Availability[]>;
  findBookingByIdempotencyKey(key: string): Promise<Booking | null>;
  saveBooking(booking: Booking): Promise<Booking>;
}

export interface PmsAdapter {
  pullInventory(hotelId: string): Promise<void>;
  pushReservation(booking: Booking): Promise<{ externalId: string }>;
}

export interface ChannelManagerAdapter {
  syncRatesAndAvailability(hotelId: string): Promise<void>;
}

export interface BookingEngineAdapter {
  quote(input: { roomTypeId: string; checkIn: string; checkOut: string; guests: number }): Promise<{ total: number; available: boolean }>;
  hold(input: { roomTypeId: string; checkIn: string; checkOut: string }): Promise<{ holdId: string; expiresAt: string }>;
}

export interface PaymentProvider {
  authorizeDemo(input: { bookingId: string; amount: number; currency: string }): Promise<{ paymentAttemptId: string; authorized: boolean }>;
}

export interface CrmAdapter {
  upsertGuest(guest: Guest): Promise<{ contactId: string }>;
  trackBooking(booking: Booking): Promise<void>;
}
