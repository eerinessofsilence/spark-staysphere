'use client';

import Link from 'next/link';
import { CheckCircle, Envelope, Phone } from '@phosphor-icons/react/dist/ssr';
import { CalendarIcon, CheckIcon, MapPinIcon, UsersIcon } from '@heroicons/react/24/outline';
import { coverPhoto } from '@/lib/domain/room-attributes';
import { pill } from '@/lib/ui';
import { useLocale, useT } from '@/lib/i18n/context';
import { lDate, lDateRange, lGuests, lMoney, lNights, lPaymentMethod, lPricingUnit, lRoomNumber, lView } from '@/lib/i18n/format';
import type { Booking, PaymentMethod, PriceBreakdown, RoomType } from '@/lib/domain/schemas';
import type { AddOn, Hotel } from '@/lib/domain/schemas';
import { InvoiceButton, type InvoiceData } from '@/components/booking/invoice-modal';
import { RememberTrip } from '@/components/trips/remember-trip';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';

interface ConfirmationViewProps {
  booking: Booking;
  room: RoomType | null;
  hotel: Hotel;
  addOns: AddOn[];
  breakdown: PriceBreakdown | null;
  nights: number;
  paymentMethod: PaymentMethod | null;
  authorized: boolean;
}

export function ConfirmationView({
  booking,
  room,
  hotel,
  addOns,
  breakdown,
  nights,
  paymentMethod,
  authorized,
}: ConfirmationViewProps) {
  const t = useT();
  const { locale } = useLocale();
  const methodLabel = paymentMethod ? lPaymentMethod(paymentMethod, locale) : null;

  const invoice: InvoiceData = {
    reference: booking.reference,
    issuedOn: booking.createdAt.slice(0, 10),
    hotelName: hotel.name,
    hotelLocation: hotel.location,
    guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
    guestEmail: booking.guest.email,
    roomName: room?.name ?? booking.roomTypeId,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    nights,
    currency: booking.currency,
    lines: breakdown
      ? [
          {
            label: `${room?.name ?? t('confirm.roomFallback')} — ${lMoney(breakdown.nightlyPrice, breakdown.currency, locale)} × ${lNights(nights, locale)}`,
            amount: breakdown.roomTotal,
          },
          ...breakdown.addOnLines.map((line) => ({
            label: line.quantity > 1 ? `${line.name} × ${line.quantity}` : line.name,
            amount: line.total,
          })),
        ]
      : [{ label: room?.name ?? t('confirm.roomFallback'), amount: booking.total }],
    taxesAndFees: breakdown?.taxesAndFees ?? 0,
    total: booking.total,
    methodLabel,
    paid: authorized,
  };

  return (
    <>
      {/* The stay joins this browser's "My trips" list the moment it exists. */}
      <RememberTrip reference={booking.reference} />
      <SiteHeader />
      <main id="main" className="container-reading py-10">
        <div className="rounded-[18px] bg-card p-6 shadow-soft sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-success">
                <CheckCircle weight="fill" className="size-5" aria-hidden="true" />
                {t('confirm.bookingConfirmed')}
              </p>
              <h1 className="text-display mt-4 text-4xl sm:text-5xl">{t('confirm.youAreBookedIn')}</h1>
              <p className="mt-4 max-w-lg text-base text-muted-foreground">
                {t('confirm.introText', {
                  guest: booking.guest.firstName,
                  room: room?.name ?? t('confirm.roomFallback'),
                  hotel: hotel.name,
                })}
              </p>
            </div>
            <div className="rounded-3xl bg-stone/70 px-5 py-4">
              <p className="text-sm text-muted-foreground">{t('confirm.bookingNumber')}</p>
              <p className="text-display mt-1 text-3xl tracking-wide">
                {booking.reference}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('confirm.bookedOn', { date: lDate(booking.createdAt.slice(0, 10), locale) })}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-media">
            {room && coverPhoto(room) ? (
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-stone">
                <img
                  src={coverPhoto(room)!.url}
                  alt={room.name}
                  width={coverPhoto(room)!.width}
                  height={coverPhoto(room)!.height}
                  className="size-full object-cover"
                />
                {/* The photograph was the only thing on this page that said
                    nothing. Named on the glass, it reads as the room that was
                    booked rather than as decoration beside the details. */}
                <span className="glass absolute right-3 bottom-3 left-3 rounded-full px-3.5 py-2 text-sm font-medium">
                  {room.name}
                </span>
              </div>
            ) : null}
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail icon={CalendarIcon} label={t('confirm.dates')}>
                {lDateRange(booking.checkIn, booking.checkOut, locale)}
                <span className="block text-muted-foreground">{lNights(nights, locale)}</span>
              </Detail>
              <Detail icon={UsersIcon} label={t('confirm.guests')}>
                {lGuests(booking.adults, booking.children, locale)}
              </Detail>
              <Detail icon={MapPinIcon} label={t('confirm.room')}>
                {room?.name ?? booking.roomTypeId}
                {booking.unitNumber ? (
                  <span className="block">{lRoomNumber(booking.unitNumber, locale)}</span>
                ) : null}
                {room ? (
                  <span className="block text-muted-foreground">
                    {room.areaM2} m² · {lView(room.view, locale)}
                  </span>
                ) : null}
              </Detail>
              <Detail icon={Envelope} label={t('confirm.confirmationTo')}>
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
              {t('confirm.servicesAdded')}
            </h2>
            {addOns.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{t('confirm.noExtraServices')}</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {addOns.map((addOn) => (
                  <li
                    key={addOn.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-3xl border border-border p-4 text-sm"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <CheckIcon className="size-4 text-success" aria-hidden="true" />
                      {addOn.name}
                    </span>
                    <span className="text-muted-foreground">
                      {lMoney(addOn.price, addOn.currency, locale)} {lPricingUnit(addOn.pricingUnit, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="total-heading" className="mt-8 rounded-3xl bg-stone/60 p-6">
            <h2 id="total-heading" className="text-display text-2xl">
              {t('confirm.whatYouPaid')}
            </h2>
            {breakdown ? (
              <dl className="mt-3 grid gap-2 text-sm">
                <Row
                  label={`${lMoney(breakdown.nightlyPrice, breakdown.currency, locale)} × ${lNights(nights, locale)}`}
                  value={lMoney(breakdown.roomTotal, breakdown.currency, locale)}
                />
                {breakdown.addOnLines.map((line) => (
                  <Row
                    key={line.addOnId}
                    label={`${line.name}${line.quantity > 1 ? ` × ${line.quantity}` : ''}`}
                    value={lMoney(line.total, breakdown.currency, locale)}
                  />
                ))}
                <Row
                  label={t('room.taxesAndFees')}
                  value={lMoney(breakdown.taxesAndFees, breakdown.currency, locale)}
                />
              </dl>
            ) : null}
            <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-border pt-4">
              <span className="text-sm font-medium">{t('confirm.total')}</span>
              <span className="text-display text-4xl">{lMoney(booking.total, booking.currency, locale)}</span>
            </div>
            {methodLabel ? (
              <p className="mt-3 flex items-baseline justify-between gap-4 text-sm">
                <span className="text-muted-foreground">{t('confirm.paidWith')}</span>
                <span className="font-semibold">{methodLabel}</span>
              </p>
            ) : null}
          </section>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/rooms" className={pill('primary')}>
              {t('confirm.bookAnotherRoom')}
            </Link>
            <InvoiceButton invoice={invoice} />
            <Link href="/admin" className={pill('secondary')}>
              {t('confirm.seeInHotelAdmin')}
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {t('confirm.footerNote', { reference: booking.reference })}
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
  icon: typeof CheckIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
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
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
