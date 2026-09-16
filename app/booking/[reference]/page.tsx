import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BookingError } from '@/lib/application/booking-service';
import { bookingService, catalogService, DEMO_HOTEL_SLUG } from '@/lib/application/container';
import { buildPriceBreakdown, nightsBetween } from '@/lib/domain/pricing';
import type { PaymentMethod } from '@/lib/domain/schemas';
import { ConfirmationView } from '@/components/booking/confirmation-view';

const PAYMENT_METHODS: readonly string[] = ['card', 'apple_pay', 'google_pay', 'bank_transfer', 'pay_at_hotel'];

export const metadata: Metadata = {
  title: 'Booking confirmed — Asteria Cove | SPARK StaySphere 360',
};

export default async function ConfirmationPage({ params }: PageProps<'/booking/[reference]'>) {
  const { reference } = await params;

  const confirmation = await bookingService.getConfirmation(reference).catch((error: unknown) => {
    if (error instanceof BookingError && error.code === 'not_found') notFound();
    throw error;
  });

  const { booking, room, ratePlan, addOns, payments } = confirmation;
  const hotel = await catalogService.getHotel(DEMO_HOTEL_SLUG);
  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const breakdown = ratePlan
    ? buildPriceBreakdown({
        ratePlan,
        addOns,
        nights,
        adults: booking.adults,
        children: booking.children,
      })
    : null;
  const authorized = payments.some((payment) => payment.status === 'authorized');
  // The provider column holds the method the guest chose.
  const method = payments.at(-1)?.provider;
  const paymentMethod: PaymentMethod | null =
    method && PAYMENT_METHODS.includes(method) ? (method as PaymentMethod) : null;

  return (
    <ConfirmationView
      booking={booking}
      room={room}
      hotel={hotel}
      addOns={addOns}
      breakdown={breakdown}
      nights={nights}
      paymentMethod={paymentMethod}
      authorized={authorized}
    />
  );
}
