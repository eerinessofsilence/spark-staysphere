import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DEMO_HOTEL_SLUG } from '@/lib/application/guest-config';
import { getPublicBookingConfirmation, getPublicGuestConversation, getPublicHotel, PmsApiError } from '@/lib/application/pms-api';
import { buildPriceBreakdown, nightsBetween } from '@/lib/domain/pricing';
import type { PaymentMethod } from '@/lib/domain/schemas';
import { ConfirmationView } from '@/components/booking/confirmation-view';

const PAYMENT_METHODS: readonly string[] = ['card', 'apple_pay', 'google_pay', 'bank_transfer', 'pay_at_hotel'];

export const metadata: Metadata = {
  title: 'Booking confirmed — Asteria Cove | SPARK StaySphere 360',
};

export default async function ConfirmationPage({ params }: PageProps<'/booking/[reference]'>) {
  const { reference } = await params;

  const confirmation = await getPublicBookingConfirmation(reference).catch((error: unknown) => {
    if (error instanceof PmsApiError && error.status === 404) notFound();
    throw error;
  });

  const { booking, room, ratePlan, addOns, payments } = confirmation;
  const hotel = await getPublicHotel(DEMO_HOTEL_SLUG);
  const initialChat = await getPublicGuestConversation(reference, booking.guest.email).catch(() => null);
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
      initialChat={initialChat}
    />
  );
}
