import { differenceInCalendarDays } from 'date-fns';
import type {
  BookingEngineAdapter,
  ChannelManagerAdapter,
  CrmAdapter,
  PaymentProvider,
  PmsAdapter,
} from '../domain/ports';
import type { Booking, Guest, IntegrationStatus } from '../domain/schemas';
import { demoRates } from './mock-data';
import { mockHotelRepository } from './mock-hotel-repository';

export const mockBookingEngineAdapter: BookingEngineAdapter = {
  async quote({ roomTypeId, checkIn, checkOut }) {
    const nights = Math.max(1, differenceInCalendarDays(new Date(checkOut), new Date(checkIn)));
    const rate = demoRates.find((plan) => plan.roomTypeId === roomTypeId);
    const [availability] = await mockHotelRepository.getAvailability(roomTypeId, checkIn, checkOut);
    return {
      total: rate ? rate.nightlyPrice * nights : 0,
      available: Boolean(rate) && availability?.status !== 'sold_out',
    };
  },
  async hold({ roomTypeId }) {
    return {
      holdId: `hold_${roomTypeId}_${Date.now()}`,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  },
};

export const mockPaymentProvider: PaymentProvider = {
  async authorizeDemo({ bookingId, amount, currency }) {
    return {
      paymentAttemptId: `pay_demo_${bookingId}`,
      authorized: amount >= 0 && currency.length === 3,
    };
  },
};

export const mockPmsAdapter: PmsAdapter = {
  async pullInventory() {},
  async pushReservation(booking: Booking) {
    return { externalId: `pms_${booking.id}` };
  },
};

export const mockChannelManagerAdapter: ChannelManagerAdapter = {
  async syncRatesAndAvailability() {},
};

export const mockCrmAdapter: CrmAdapter = {
  async upsertGuest(guest: Guest) {
    return { contactId: `crm_${guest.email}` };
  },
  async trackBooking() {},
};

export const demoIntegrationStatuses: IntegrationStatus[] = [
  { adapter: 'pms', mode: 'mock', connected: false, lastSyncAt: null },
  { adapter: 'channel_manager', mode: 'mock', connected: false, lastSyncAt: null },
  { adapter: 'booking_engine', mode: 'mock', connected: true, lastSyncAt: null },
  { adapter: 'payment', mode: 'mock', connected: true, lastSyncAt: null },
  { adapter: 'crm', mode: 'mock', connected: false, lastSyncAt: null },
];
