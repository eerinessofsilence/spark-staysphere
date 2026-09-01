import type {
  AddOn,
  Availability,
  Booking,
  Guest,
  Hotel,
  IntegrationStatus,
  PaymentAttempt,
  Quote,
  RatePlan,
  RoomStatus,
  RoomType,
} from './schemas';

export interface HotelRepository {
  getHotel(slug: string): Promise<Hotel | null>;
  listRooms(hotelId: string): Promise<RoomType[]>;
  listRatePlans(roomTypeId: string): Promise<RatePlan[]>;
  listAddOns(hotelId: string): Promise<AddOn[]>;
  getAvailability(roomTypeId: string, from: string, to: string): Promise<Availability[]>;
  findBookingByIdempotencyKey(key: string): Promise<Booking | null>;
  saveBooking(booking: Booking): Promise<Booking>;
  getBookingByReference(reference: string): Promise<Booking | null>;
  listBookings(): Promise<Booking[]>;
  savePaymentAttempt(attempt: PaymentAttempt): Promise<PaymentAttempt>;
  listPaymentAttempts(bookingId: string): Promise<PaymentAttempt[]>;
}

/**
 * Demo-only inventory controls backing `/admin`. Production replaces this with
 * PMS write-through; the guest-facing code never depends on it.
 */
export interface DemoControlPort {
  setRoomStatusOverride(roomTypeId: string, status: RoomStatus | null): Promise<void>;
  getRoomStatusOverride(roomTypeId: string): Promise<RoomStatus | null>;
  setAddOnEnabled(addOnId: string, enabled: boolean): Promise<void>;
  listIntegrationStatuses(): Promise<IntegrationStatus[]>;
  reset(): Promise<void>;
}

export interface PmsAdapter {
  pullInventory(hotelId: string): Promise<void>;
  pushReservation(booking: Booking): Promise<{ externalId: string }>;
}

export interface ChannelManagerAdapter {
  syncRatesAndAvailability(hotelId: string): Promise<void>;
}

export interface QuoteRequest {
  roomTypeId: string;
  ratePlanId?: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  addOnIds: string[];
}

export interface BookingEngineAdapter {
  /** Authoritative price and availability for a stay, including selected add-ons. */
  quote(input: QuoteRequest): Promise<Quote>;
  hold(input: { roomTypeId: string; checkIn: string; checkOut: string }): Promise<{ holdId: string; expiresAt: string }>;
}

export interface PaymentProvider {
  authorizeDemo(input: { bookingId: string; amount: number; currency: string }): Promise<{ paymentAttemptId: string; authorized: boolean; declineReason?: string }>;
}

export interface CrmAdapter {
  upsertGuest(guest: Guest): Promise<{ contactId: string }>;
  trackBooking(booking: Booking): Promise<void>;
}
