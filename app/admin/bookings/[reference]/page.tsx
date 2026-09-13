import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PushPin } from '@phosphor-icons/react/dist/ssr';
import { ArrowLeftIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import { BookingError } from '@/lib/application/booking-service';
import { bookingService, inventoryService } from '@/lib/application/container';
import { toIsoDate } from '@/lib/application/search-params';
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
import { pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { BookingActions } from '@/components/admin/operations/booking-actions';
import { stayBucket, stayBucketLabels } from '@/components/admin/operations/booking-buckets';
import { BookingStatusBadge } from '@/components/admin/operations/booking-status-badge';
import { attemptStatus, methodLabel } from '@/components/admin/operations/payment-state';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ reference: string }> }): Promise<Metadata> {
  const { reference } = await params;
  return { title: `${reference} — Bookings | SPARK StaySphere 360` };
}

function timestamp(iso: string): string {
  return `${formatDate(iso.slice(0, 10))}, ${iso.slice(11, 16)} UTC`;
}

export default async function BookingDetailPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const confirmation = await bookingService.getConfirmation(reference).catch((error: unknown) => {
    if (error instanceof BookingError && error.code === 'not_found') notFound();
    throw error;
  });

  const { booking, room, ratePlan, addOns, payments } = confirmation;
  const today = toIsoDate(new Date());
  const assigned = await inventoryService.getBookingRoom(booking);
  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const breakdown = ratePlan
    ? buildPriceBreakdown({ ratePlan, addOns, nights, adults: booking.adults, children: booking.children })
    : null;
  const drifted = breakdown !== null && Math.abs(breakdown.total - booking.total) > 0.005;
  const bucket = stayBucket(booking, today);
  const canCancel = booking.status === 'confirmed' && booking.checkIn > today;
  const note =
    booking.status === 'cancelled'
      ? 'This booking is cancelled; there is nothing left to cancel.'
      : !canCancel
        ? 'The stay has begun — changes from here are handled at the desk.'
        : null;
  const guestName = `${booking.guest.firstName} ${booking.guest.lastName}`;

  return (
    <AdminPage>
      <nav aria-label="Breadcrumb" className="mb-6 text-sm">
        <Link href="/admin/bookings" className={pill('secondary')}>
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Bookings
        </Link>
      </nav>

      <AdminPageHeader
        title={booking.reference}
        description={`${guestName} · ${room?.name ?? booking.roomTypeId} · ${formatDateRange(booking.checkIn, booking.checkOut)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={booking.status} />
            {booking.status !== 'cancelled' ? <span className={tag()}>{stayBucketLabels[bucket]}</span> : null}
          </div>
        }
      />

      <div className="mt-6">
        <BookingActions reference={booking.reference} canCancel={canCancel} note={note} />
      </div>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <Card id="guest-heading" title="Guest">
          <dl>
            <Row label="Name">{guestName}</Row>
            <Row label="Email">
              <a href={`mailto:${booking.guest.email}`} className="hover:text-accent-strong">
                {booking.guest.email}
              </a>
            </Row>
            <Row label="Phone">
              <a href={`tel:${booking.guest.phone.replace(/\s+/g, '')}`} className="hover:text-accent-strong">
                {booking.guest.phone}
              </a>
            </Row>
            <Row label="Party">{formatGuests(booking.adults, booking.children)}</Row>
          </dl>
        </Card>

        <Card id="stay-heading" title="Stay">
          <dl>
            <Row label="Dates">
              {formatDateRange(booking.checkIn, booking.checkOut)}
              <span className="block text-xs font-normal text-muted-foreground">{formatNights(nights)}</span>
            </Row>
            <Row label="Room type">
              {room ? (
                <Link href={`/admin/content/rooms/${room.id}`} className="hover:text-accent-strong">
                  {room.name}
                </Link>
              ) : (
                booking.roomTypeId
              )}
              {room ? (
                <span className="block text-xs font-normal text-muted-foreground">
                  {room.areaM2} m² · {viewLabels[room.view]}
                </span>
              ) : null}
            </Row>
            <Row label="Room">
              {assigned ? (
                <span className="inline-flex flex-col items-end">
                  <span>Room {assigned.number}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                    {booking.status === 'cancelled' ? (
                      'Released'
                    ) : assigned.chosenByGuest ? (
                      <>
                        <PushPin weight="fill" className="size-3.5 text-foreground" aria-hidden="true" />
                        Chosen by the guest
                      </>
                    ) : (
                      'Assigned automatically'
                    )}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {booking.status === 'cancelled' ? 'Released' : 'Not assigned'}
                </span>
              )}
            </Row>
          </dl>
          <Link href={`/admin/chessboard?from=${booking.checkIn}`} className={pill('secondary', 'mt-4')}>
            <TableCellsIcon className="size-4" aria-hidden="true" />
            Show on chessboard
          </Link>
        </Card>

        <Card id="extras-heading" title="Extras">
          {addOns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No extras were added to this stay.</p>
          ) : (
            <ul className="divide-y divide-border">
              {addOns.map((addOn) => (
                <li key={addOn.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5 text-sm">
                  <span className={cn('font-medium', addOn.parentId && 'pl-4')}>
                    {addOn.parentId ? <span className="text-muted-foreground">+ </span> : null}
                    {addOn.name}
                  </span>
                  <span className="text-muted-foreground">
                    {formatMoney(addOn.price, addOn.currency)} {formatPricingUnit(addOn.pricingUnit)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card id="money-heading" title="Money">
          {breakdown ? (
            <dl>
              <Row label={`${formatMoney(breakdown.nightlyPrice, breakdown.currency)} × ${formatNights(nights)}`}>
                {formatMoney(breakdown.roomTotal, breakdown.currency)}
              </Row>
              {breakdown.addOnLines.map((line) => (
                <Row key={line.addOnId} label={`${line.name}${line.quantity > 1 ? ` × ${line.quantity}` : ''}`}>
                  {formatMoney(line.total, breakdown.currency)}
                </Row>
              ))}
              <Row label="Taxes and city fees">{formatMoney(breakdown.taxesAndFees, breakdown.currency)}</Row>
            </dl>
          ) : null}
          <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-border pt-3">
            <span className="text-sm font-medium">Total agreed</span>
            <span className="text-display text-3xl">{formatMoney(booking.total, booking.currency)}</span>
          </div>
          {drifted ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Today&apos;s prices would come to {formatMoney(breakdown!.total, booking.currency)}. The stored total
              above is what the guest agreed to and is never recalculated.
            </p>
          ) : null}
        </Card>

        <Card id="payments-heading" title="Payment attempts">
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment attempt was recorded.</p>
          ) : (
            <ul className="divide-y divide-border">
              {payments.map((payment) => {
                const state = attemptStatus[payment.status];
                return (
                  <li key={payment.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
                    <span>
                      <span className="font-medium">{methodLabel(payment.provider)}</span>
                      <span className="block text-xs text-muted-foreground">{payment.id}</span>
                    </span>
                    <span className="flex flex-col items-end">
                      <span className={cn('inline-flex items-center gap-1.5 font-medium', state.tone)}>
                        <state.icon weight="fill" className="size-4" aria-hidden="true" />
                        {state.label}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatMoney(payment.amount, payment.currency)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Demo payments — no card data is collected and no money moves.</p>
        </Card>

        <Card id="activity-heading" title="Activity">
          <ol className="grid gap-3 text-sm">
            <Event label="Booked on the guest site" detail={timestamp(booking.createdAt)} />
            {booking.status !== 'draft' && booking.status !== 'held' ? (
              <Event label="Confirmed" detail={`${timestamp(booking.createdAt)} · price rechecked on the server`} />
            ) : null}
            {booking.status === 'cancelled' ? (
              <Event label="Cancelled" detail="The time isn't recorded in this demo." />
            ) : (
              <>
                <Event label="Check-in" detail={formatDate(booking.checkIn)} future={booking.checkIn > today} />
                <Event label="Check-out" detail={formatDate(booking.checkOut)} future={booking.checkOut > today} />
              </>
            )}
          </ol>
        </Card>
      </div>
    </AdminPage>
  );
}

function Card({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="min-w-0 rounded-[28px] bg-card p-5 shadow-soft sm:p-6">
      <h2 id={id} className="text-base font-medium">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-border py-2.5 last:border-b-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

function Event({ label, detail, future = false }: { label: string; detail: string; future?: boolean }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className={cn('mt-1.5 size-2 shrink-0 rounded-full', future ? 'border border-muted-foreground' : 'bg-foreground')}
      />
      <span>
        <span className={cn('font-medium', future && 'text-muted-foreground')}>
          {label}
          {future ? <span className="sr-only"> (upcoming)</span> : null}
        </span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </li>
  );
}
