import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PushPin } from '@phosphor-icons/react/dist/ssr';
import { ArrowLeftIcon, CheckIcon, EnvelopeIcon, PhoneIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import { BookingError } from '@/lib/application/booking-service';
import { bookingService, hotelRepository, inventoryService } from '@/lib/application/container';
import { toIsoDate } from '@/lib/application/search-params';
import { buildPriceBreakdown, nightsBetween } from '@/lib/domain/pricing';
import type { Booking, RoomType } from '@/lib/domain/schemas';
import {
  bedLabels,
  formatDate,
  formatDateShort,
  formatGuests,
  formatMoney,
  formatNights,
  formatPricingUnit,
  viewLabels,
} from '@/lib/formatting';
import { iconButton, pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { BookingActions } from '@/components/admin/operations/booking-actions';
import { stayBucket, stayBucketLabels } from '@/components/admin/operations/booking-buckets';
import { BookingStatusBadge } from '@/components/admin/operations/booking-status-badge';
import { attemptStatus, methodLabel } from '@/components/admin/operations/payment-state';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage } from '@/components/admin/shell/admin-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ reference: string }> }): Promise<Metadata> {
  const { reference } = await params;
  return { title: `${reference} — Reservations | SPARK StaySphere 360` };
}

function timestamp(iso: string): string {
  return `${formatDate(iso.slice(0, 10))}, ${iso.slice(11, 16)} UTC`;
}

function coverOf(room: RoomType | null | undefined) {
  return room?.media.find((item) => item.type === 'image');
}

export default async function BookingDetailPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const confirmation = await bookingService.getConfirmation(reference).catch((error: unknown) => {
    if (error instanceof BookingError && error.code === 'not_found') notFound();
    throw error;
  });

  const { booking, room, ratePlan, addOns, payments } = confirmation;
  const today = toIsoDate(new Date());
  const email = booking.guest.email.trim().toLowerCase();
  const [assigned, allBookings, roomTypes] = await Promise.all([
    inventoryService.getBookingRoom(booking),
    hotelRepository.listBookings(),
    hotelRepository.listRooms(booking.hotelId),
  ]);

  const history = allBookings
    .filter((candidate) => candidate.guest.email.trim().toLowerCase() === email)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const historyRooms = await Promise.all(history.map((candidate) => inventoryService.getBookingRoom(candidate)));
  const roomTypeById = new Map(roomTypes.map((type) => [type.id, type]));
  const stayed = history.filter((candidate) => candidate.status === 'confirmed');
  const nightsBooked = stayed.reduce((sum, candidate) => sum + nightsBetween(candidate.checkIn, candidate.checkOut), 0);
  const spent = stayed.reduce((sum, candidate) => sum + candidate.total, 0);

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
  const initials = `${booking.guest.firstName[0] ?? ''}${booking.guest.lastName[0] ?? ''}`.toUpperCase();
  const cover = coverOf(room);
  const lastPayment = payments.at(-1);
  const payment = lastPayment ? attemptStatus[lastPayment.status] : null;

  return (
    <AdminPage>
      <header className="flex items-center gap-3">
        <Link href="/admin/bookings" aria-label="Back to bookings" className={iconButton('light')}>
          <ArrowLeftIcon className="size-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-display text-2xl">Booking details</h1>
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link href="/admin/bookings" className="hover:text-foreground">
              Reservations
            </Link>
            <span aria-hidden="true"> / </span>
            <span aria-current="page" className="text-foreground">
              {booking.reference}
            </span>
          </nav>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-12">
        <Card id="guest-heading" title="Guest" className="xl:col-span-3">
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="grid size-16 shrink-0 place-items-center rounded-full bg-stone text-lg font-semibold"
            >
              {initials}
            </span>
            <div className="min-w-0">
              <p className="text-display truncate text-2xl">{guestName}</p>
              <p className="text-sm text-muted-foreground">
                {history.length === 1 ? 'First booking' : `${history.length} bookings`}
              </p>
            </div>
          </div>

          <ul className="mt-5 grid gap-3 border-t border-border pt-5 text-sm">
            <li className="flex min-w-0 items-center gap-3">
              <PhoneIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <a href={`tel:${booking.guest.phone.replace(/\s+/g, '')}`} className="truncate hover:text-accent-strong">
                {booking.guest.phone}
              </a>
            </li>
            <li className="flex min-w-0 items-center gap-3">
              <EnvelopeIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <a href={`mailto:${booking.guest.email}`} className="truncate hover:text-accent-strong">
                {booking.guest.email}
              </a>
            </li>
          </ul>

          <Section title="This stay">
            <Fields>
              <Field label="Adults">{booking.adults}</Field>
              <Field label="Children">{booking.children}</Field>
            </Fields>
          </Section>

          <Section title="With this hotel">
            <Fields>
              <Field label="Stays booked">{stayed.length}</Field>
              <Field label="Nights booked">{nightsBooked}</Field>
              <Field label="Total spent">{formatMoney(spent, booking.currency)}</Field>
            </Fields>
          </Section>
        </Card>

        <Card id="booking-heading" title="Booking" className="lg:order-first lg:col-span-2 xl:order-none xl:col-span-6">
          <div className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={booking.status} />
            {booking.status !== 'cancelled' ? <span className={tag()}>{stayBucketLabels[bucket]}</span> : null}
          </div>
          <p className="text-display mt-4 text-3xl">
            <span className="text-muted-foreground">Booking </span>
            {booking.reference}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Booked on the guest site · {timestamp(booking.createdAt)}</p>

          <Fields className="mt-6 sm:grid-cols-3">
            <Field label="Room type">
              {room ? (
                <Link href={`/admin/content/rooms/${room.id}`} className="hover:text-accent-strong">
                  {room.name}
                </Link>
              ) : (
                booking.roomTypeId
              )}
            </Field>
            <Field label="Room">
              {assigned ? (
                <>
                  Room {assigned.number}
                  <Sub>
                    {booking.status === 'cancelled' ? (
                      'Released'
                    ) : assigned.chosenByGuest ? (
                      <span className="inline-flex items-center gap-1">
                        <PushPin weight="fill" className="size-3.5 text-foreground" aria-hidden="true" />
                        Chosen by the guest
                      </span>
                    ) : (
                      'Assigned automatically'
                    )}
                  </Sub>
                </>
              ) : (
                <span className="text-muted-foreground">{booking.status === 'cancelled' ? 'Released' : 'Not assigned'}</span>
              )}
            </Field>
            <Field label="Rate">
              {breakdown ? (
                <>
                  {formatMoney(breakdown.nightlyPrice, breakdown.currency)}
                  <span className="font-normal text-muted-foreground"> / night</span>
                </>
              ) : (
                '—'
              )}
              {ratePlan ? <Sub>{ratePlan.name}</Sub> : null}
            </Field>
            <Field label="Guests">{formatGuests(booking.adults, booking.children)}</Field>
            <Field label="Payment">
              {lastPayment && payment ? (
                <>
                  <span className={cn('inline-flex items-center gap-1.5', payment.tone)}>
                    <payment.icon weight="fill" className="size-4" aria-hidden="true" />
                    {payment.label}
                  </span>
                  <Sub>{methodLabel(lastPayment.provider)}</Sub>
                </>
              ) : (
                <span className="text-muted-foreground">No attempt</span>
              )}
            </Field>
            <Field label="Duration">{formatNights(nights)}</Field>
            <Field label="Check-in">{formatDate(booking.checkIn)}</Field>
            <Field label="Check-out">{formatDate(booking.checkOut)}</Field>
          </Fields>

          <Section title="Extras">
            {addOns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No extras were added to this stay.</p>
            ) : (
              <ul className="grid gap-2 text-sm sm:grid-cols-2">
                {addOns.map((addOn) => (
                  <li key={addOn.id} className="flex min-w-0 gap-2">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="font-medium">{addOn.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatMoney(addOn.price, addOn.currency)} {formatPricingUnit(addOn.pricingUnit)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <div className="mt-6 flex flex-wrap items-start justify-between gap-4 border-t border-border pt-5">
            <Link href={`/admin/chessboard?from=${booking.checkIn}`} className={pill('ghost')}>
              <TableCellsIcon className="size-4" aria-hidden="true" />
              Show on Property Desk
            </Link>
            <BookingActions reference={booking.reference} canCancel={canCancel} note={note} />
          </div>
        </Card>

        <Card
          id="room-heading"
          title="Room"
          className="xl:col-span-3"
          action={
            room ? (
              <Link href={`/admin/content/rooms/${room.id}`} className="text-sm text-muted-foreground hover:text-foreground">
                Edit room
              </Link>
            ) : null
          }
        >
          {cover ? (
            <img
              src={cover.url}
              alt=""
              width={cover.width}
              height={cover.height}
              className="aspect-[4/3] w-full rounded-[20px] bg-stone object-cover"
            />
          ) : (
            <div className="grid aspect-[4/3] place-items-center rounded-[20px] bg-stone text-sm text-muted-foreground">
              No photo yet
            </div>
          )}
          {room ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              <li className={tag()}>{room.areaM2} m²</li>
              <li className={tag()}>{bedLabels[room.bedType]}</li>
              <li className={tag()}>Sleeps {room.capacity}</li>
              <li className={tag()}>{viewLabels[room.view]}</li>
            </ul>
          ) : null}

          <Section title="Price summary">
            {breakdown ? (
              <dl className="grid gap-2 text-sm">
                <Line label={`${formatMoney(breakdown.nightlyPrice, breakdown.currency)} × ${formatNights(nights)}`}>
                  {formatMoney(breakdown.roomTotal, breakdown.currency)}
                </Line>
                {breakdown.addOnLines.map((line) => (
                  <Line key={line.addOnId} label={`${line.name}${line.quantity > 1 ? ` × ${line.quantity}` : ''}`}>
                    {formatMoney(line.total, breakdown.currency)}
                  </Line>
                ))}
                <Line label="Taxes and city fees">{formatMoney(breakdown.taxesAndFees, breakdown.currency)}</Line>
              </dl>
            ) : null}
            <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-border pt-3">
              <span className="font-medium">Total agreed</span>
              <span className="text-display text-2xl">{formatMoney(booking.total, booking.currency)}</span>
            </div>
            {drifted ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Today&apos;s prices would come to {formatMoney(breakdown!.total, booking.currency)}. The stored total
                above is what the guest agreed to and is never recalculated.
              </p>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">Demo payments — no card data is collected and no money moves.</p>
          </Section>
        </Card>
      </div>

      <section aria-labelledby="history-heading" className="mt-10">
        <h2 id="history-heading" className="text-display text-2xl">
          Guest&apos;s bookings
        </h2>
        <div className="mt-4">
          <TableCard caption={`Every booking made with ${booking.guest.email}`} className="min-w-[56rem]">
            <thead>
              <tr className="border-b border-border">
                <Th>Room</Th>
                <Th>Reference</Th>
                <Th>Booked</Th>
                <Th>Check-in</Th>
                <Th>Check-out</Th>
                <Th>Guests</Th>
                <Th className="text-right">Total</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry, index) => (
                <HistoryRow
                  key={entry.id}
                  booking={entry}
                  roomType={roomTypeById.get(entry.roomTypeId)}
                  roomNumber={historyRooms[index]?.number}
                  current={entry.id === booking.id}
                />
              ))}
            </tbody>
          </TableCard>
        </div>
      </section>
    </AdminPage>
  );
}

function HistoryRow({
  booking,
  roomType,
  roomNumber,
  current,
}: {
  booking: Booking;
  roomType: RoomType | undefined;
  roomNumber: string | undefined;
  current: boolean;
}) {
  const cover = coverOf(roomType);
  return (
    <tr className={cn('border-b border-border last:border-b-0', current && 'bg-stone/40')}>
      <Td>
        <span className="flex items-center gap-3">
          {cover ? (
            <img src={cover.url} alt="" className="h-12 w-16 shrink-0 rounded-xl bg-stone object-cover" />
          ) : (
            <span aria-hidden="true" className="h-12 w-16 shrink-0 rounded-xl bg-stone" />
          )}
          <span className="min-w-0">
            <span className="block font-medium">{roomType?.name ?? booking.roomTypeId}</span>
            <span className="block text-xs text-muted-foreground">{roomNumber ? `Room ${roomNumber}` : 'Not assigned'}</span>
          </span>
        </span>
      </Td>
      <Td className="whitespace-nowrap">
        {current ? (
          <span className="font-medium">
            {booking.reference}
            <span className="block text-xs font-normal text-muted-foreground">This booking</span>
          </span>
        ) : (
          <Link href={`/admin/bookings/${booking.reference}`} className="font-medium hover:text-accent-strong">
            {booking.reference}
          </Link>
        )}
      </Td>
      <Td className="whitespace-nowrap">{formatDateShort(booking.createdAt.slice(0, 10))}</Td>
      <Td className="whitespace-nowrap">{formatDateShort(booking.checkIn)}</Td>
      <Td className="whitespace-nowrap">{formatDateShort(booking.checkOut)}</Td>
      <Td className="whitespace-nowrap">{formatGuests(booking.adults, booking.children)}</Td>
      <Td className="text-right font-medium whitespace-nowrap tabular-nums">{formatMoney(booking.total, booking.currency)}</Td>
      <Td>
        <BookingStatusBadge status={booking.status} />
      </Td>
    </tr>
  );
}

function Card({
  id,
  title,
  action,
  className,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn('min-w-0 rounded-[28px] bg-card p-5 shadow-soft sm:p-6', className)}>
      <div className="flex items-center justify-between gap-4">
        <h2 id={id} className="text-base font-medium">
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-5 border-t border-border pt-5">
      <h3 className="mb-3 font-medium">{title}</h3>
      {children}
    </div>
  );
}

function Fields({ className, children }: { className?: string; children: ReactNode }) {
  return <dl className={cn('grid grid-cols-2 gap-x-4 gap-y-4', className)}>{children}</dl>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children}</dd>
    </div>
  );
}

function Sub({ children }: { children: ReactNode }) {
  return <span className="block text-xs font-normal text-muted-foreground">{children}</span>;
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{children}</dd>
    </div>
  );
}
