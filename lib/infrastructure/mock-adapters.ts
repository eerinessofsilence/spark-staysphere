import type {
  BookingEngineAdapter,
  ChannelManagerAdapter,
  CrmAdapter,
  HotelRepository,
  PaymentProvider,
  PmsAdapter,
  QuoteRequest,
} from '../domain/ports';
import { statusForRemaining } from '../domain/availability';
import { buildPriceBreakdown, nightsBetween } from '../domain/pricing';
import type { Booking, Guest, Quote } from '../domain/schemas';
import { demoHotel } from './mock-data';

/** Holds live for 15 minutes in the demo, matching the quote validity window. */
const HOLD_MINUTES = 15;

/**
 * The booking engine reads availability and add-on enablement through
 * whichever repository the caller passes in, so a quote always sees the same
 * durable state (D1 or in-memory) that a subsequent booking will write to —
 * container.ts wires this with the same `hotelRepository` it exports.
 */
export function createBookingEngineAdapter(repository: HotelRepository): BookingEngineAdapter {
  return {
    async quote(input: QuoteRequest): Promise<Quote> {
      const nights = nightsBetween(input.checkIn, input.checkOut);
      const ratePlans = await repository.listRatePlans(input.roomTypeId);
      const ratePlan = input.ratePlanId
        ? (ratePlans.find((plan) => plan.id === input.ratePlanId) ?? ratePlans[0])
        : ratePlans[0];

      const availability = await repository.getAvailability(
        input.roomTypeId,
        input.checkIn,
        input.checkOut,
      );
      // A stay is only sellable if every night of it is sellable.
      const remaining = availability.length
        ? Math.min(...availability.map((night) => night.remaining))
        : 0;
      const status = statusForRemaining(remaining);

      const catalogAddOns = await repository.listAddOns(demoHotel.id);
      const selectedAddOns = catalogAddOns.filter(
        (addOn) => addOn.enabled && input.addOnIds.includes(addOn.id),
      );

      const price = ratePlan
        ? buildPriceBreakdown({
            ratePlan,
            addOns: selectedAddOns,
            nights,
            adults: input.adults,
            children: input.children,
          })
        : {
            nights,
            nightlyPrice: 0,
            roomTotal: 0,
            addOnLines: [],
            addOnsTotal: 0,
            taxesAndFees: 0,
            total: 0,
            currency: demoHotel.currency,
            otaComparisonTotal: null,
            directSaving: 0,
          };

      return {
        roomTypeId: input.roomTypeId,
        ratePlanId: ratePlan?.id ?? '',
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        adults: input.adults,
        children: input.children,
        addOnIds: selectedAddOns.map((addOn) => addOn.id),
        available: Boolean(ratePlan) && status !== 'sold_out',
        status,
        remaining,
        price,
        expiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString(),
      };
    },
    async hold({ roomTypeId }) {
      return {
        holdId: `hold_${roomTypeId}_${Date.now()}`,
        expiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString(),
      };
    },
  };
}

export const mockPaymentProvider: PaymentProvider = {
  async authorizeDemo({ bookingId, amount, currency }) {
    const valid = amount >= 0 && currency.length === 3;
    return {
      paymentAttemptId: `pay_demo_${bookingId}`,
      authorized: valid,
      declineReason: valid ? undefined : 'Demo authorization rejected an invalid amount or currency.',
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

