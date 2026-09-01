import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, Check, Mail, MapPin, Phone, Users } from 'lucide-react';
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
import { RoomVisual } from '@/components/rooms/room-visual';
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
      <main id="main" className="mx-auto max-w-[1000px] px-4 py-10 sm:px-6 lg:px-10">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow flex items-center gap-2 text-success">
                <span className="grid size-5 place-items-center rounded-full bg-success/15">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
                Booking confirmed
              </p>
              <h1 className="text-display mt-3 text-4xl sm:text-5xl">You are booked in</h1>
              <p className="mt-3 max-w-lg text-muted-foreground">
                {booking.guest.firstName}, your {room?.name ?? 'room'} at {hotel.name} is held under
                the reference below. This is a demo booking — no payment was taken and no real
                reservation exists.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-canvas px-5 py-4">
              <p className="eyebrow text-muted-foreground">Reference</p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-wide">
                {booking.reference}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Booked {formatDate(booking.createdAt.slice(0, 10))}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
            {room ? (
              <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-ink">
                <RoomVisual room={room} />
              </div>
            ) : null}
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail icon={CalendarDays} label="Dates">
                {formatDateRange(booking.checkIn, booking.checkOut)}
                <span className="block text-muted-foreground">{formatNights(nights)}</span>
              </Detail>
              <Detail icon={Users} label="Guests">
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
              <Detail icon={Mail} label="Confirmation to">
                {booking.guest.email}
                <span className="block text-muted-foreground">
                  <Phone className="mr-1 inline size-3" aria-hidden="true" />
                  {booking.guest.phone}
                </span>
              </Detail>
            </dl>
          </div>

          <section aria-labelledby="services-heading" className="mt-8">
            <h2 id="services-heading" className="text-sm font-semibold">
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
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl border border-border p-3.5 text-sm"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <Check className="size-4 text-success" aria-hidden="true" />
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

          <section aria-labelledby="total-heading" className="mt-8 rounded-2xl bg-canvas p-5">
            <h2 id="total-heading" className="text-sm font-semibold">
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
              <span className="text-sm font-semibold">Total</span>
              <span className="text-display text-3xl">
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
            <Link
              href="/rooms"
              className="flex min-h-11 items-center rounded-xl bg-cyan px-5 text-sm font-semibold text-ink hover:bg-cyan/85"
            >
              Book another room
            </Link>
            <Link
              href="/admin"
              className="flex min-h-11 items-center rounded-xl border border-border px-5 text-sm font-semibold hover:bg-canvas"
            >
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
      <dt className="eyebrow flex items-center gap-1.5 text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
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
