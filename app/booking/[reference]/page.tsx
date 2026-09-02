import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarBlank, Check, CheckCircle, Envelope, MapPin, Phone, UsersThree } from '@phosphor-icons/react/dist/ssr';
import { coverPhoto } from '@/lib/domain/room-attributes';
import { pill } from '@/lib/ui';
import { BookingError } from '@/lib/application/booking-service';
import { bookingService, catalogService, DEMO_HOTEL_SLUG } from '@/lib/application/container';
import { buildPriceBreakdown, nightsBetween } from '@/lib/domain/pricing';
import {
  formatDate,
  formatDateRange,
  formatGuests,
  formatMoney,
  formatNights,
  formatPricingUnit,
  viewLabels,
} from '@/lib/formatting';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';

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

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[1000px] px-3 py-10 sm:px-6">
        <div className="rounded-[28px] bg-card p-6 shadow-soft sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-success">
                <CheckCircle weight="fill" className="size-5" aria-hidden="true" />
                Booking confirmed
              </p>
              <h1 className="text-display mt-4 text-5xl sm:text-6xl">You are booked in</h1>
              <p className="mt-4 max-w-lg text-[15px] text-muted-foreground">
                {booking.guest.firstName}, your {room?.name ?? 'room'} at {hotel.name} is held under
                the reference shown here. This is a demo booking — no payment was taken and no real
                reservation exists.
              </p>
            </div>
            <div className="rounded-3xl bg-stone/70 px-5 py-4">
              <p className="text-sm text-muted-foreground">Reference</p>
              <p className="text-display mt-1 text-3xl tracking-wide">
                {booking.reference}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Booked {formatDate(booking.createdAt.slice(0, 10))}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
            {room && coverPhoto(room) ? (
              <div className="aspect-[4/3] overflow-hidden rounded-3xl bg-stone">
                <img
                  src={coverPhoto(room)!.url}
                  alt={room.name}
                  width={coverPhoto(room)!.width}
                  height={coverPhoto(room)!.height}
                  className="size-full object-cover"
                />
              </div>
            ) : null}
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail icon={CalendarBlank} label="Dates">
                {formatDateRange(booking.checkIn, booking.checkOut)}
                <span className="block text-muted-foreground">{formatNights(nights)}</span>
              </Detail>
              <Detail icon={UsersThree} label="Guests">
                {formatGuests(booking.adults, booking.children)}
              </Detail>
              <Detail icon={MapPin} label="Room">
                {room?.name ?? booking.roomTypeId}
                {room ? (
                  <span className="block text-muted-foreground">
                    {room.areaM2} m² · {viewLabels[room.view]}
                  </span>
                ) : null}
              </Detail>
              <Detail icon={Envelope} label="Confirmation to">
                {booking.guest.email}
                <span className="block text-muted-foreground">
                  <Phone weight="fill" className="mr-1 inline size-3" aria-hidden="true" />
                  {booking.guest.phone}
                </span>
              </Detail>
            </dl>
          </div>

          <section aria-labelledby="services-heading" className="mt-8">
            <h2 id="services-heading" className="text-display text-2xl">
              Services added
            </h2>
            {addOns.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No extra services were added to this stay.
              </p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {addOns.map((addOn) => (
                  <li
                    key={addOn.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-3xl border border-border p-4 text-sm"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <Check weight="bold" className="size-4 text-success" aria-hidden="true" />
                      {addOn.name}
                    </span>
                    <span className="text-muted-foreground">
                      {formatMoney(addOn.price, addOn.currency)}{' '}
                      {formatPricingUnit(addOn.pricingUnit)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="total-heading" className="mt-8 rounded-3xl bg-stone/60 p-6">
            <h2 id="total-heading" className="text-display text-2xl">
              What you paid
            </h2>
            {breakdown ? (
              <dl className="mt-3 grid gap-2 text-sm">
                <Row
                  label={`${formatMoney(breakdown.nightlyPrice, breakdown.currency)} × ${formatNights(nights)}`}
                  value={formatMoney(breakdown.roomTotal, breakdown.currency)}
                />
                {breakdown.addOnLines.map((line) => (
                  <Row
                    key={line.addOnId}
                    label={`${line.name}${line.quantity > 1 ? ` × ${line.quantity}` : ''}`}
                    value={formatMoney(line.total, breakdown.currency)}
                  />
                ))}
                <Row
                  label="Taxes and city fees"
                  value={formatMoney(breakdown.taxesAndFees, breakdown.currency)}
                />
              </dl>
            ) : null}
            <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-border pt-4">
              <span className="text-sm font-medium">Total</span>
              <span className="text-display text-4xl">
                {formatMoney(booking.total, booking.currency)}
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {authorized
                ? 'Demo payment authorized by the mock provider. No card details were collected and no money moved.'
                : 'No payment attempt was recorded for this demo booking.'}
              {ratePlan ? ` ${ratePlan.cancellationPolicy}` : ''}
            </p>
          </section>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/rooms" className={pill('primary')}>
              Book another room
            </Link>
            <Link href="/admin" className={pill('secondary')}>
              See it in the hotel admin
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Demo bookings live in the server process and disappear when it restarts. Keep this tab
          open if you want to come back to {booking.reference}.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}

function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Check;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon weight="fill" className="size-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1.5 text-sm font-medium">{children}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
