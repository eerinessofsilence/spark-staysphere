import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowTopRightOnSquareIcon, CheckIcon, EnvelopeIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { BookingError } from '@/lib/application/booking-service';
import { bookingGuestService, bookingService, catalogService, guestAppUrl, hotelRepository, inventoryService, ordersService } from '@/lib/application/container';
import { buildInvoiceDetails } from '@/lib/application/accounting-invoices';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { toIsoDate } from '@/lib/application/search-params';
import { buildPriceBreakdown, nightsBetween } from '@/lib/domain/pricing';
import type { Booking, RoomType } from '@/lib/domain/schemas';
import type { AdminLocale } from '@/lib/i18n/admin/locale';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT, type AdminT } from '@/lib/i18n/admin/translate';
import {
  lDate,
  lDateShort,
  lGuests,
  lMoney,
  lPricingUnit,
  lRoomNumber,
  lStayRoomPriceLabel,
  lNightlyPrice,
} from '@/lib/i18n/format';
import { pluralForm } from '@/lib/i18n/plural';
import { pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { BookingHeaderActions } from '@/components/admin/operations/booking-actions';
import { EditBookingStayButton } from '@/components/admin/operations/edit-booking-stay-button';
import { LATE_CHECK_OUT_TIME, STANDARD_CHECK_IN_TIME, STANDARD_CHECK_OUT_TIME } from '@/lib/domain/stay-times';
import { AddBookingGuestButton } from '@/components/admin/operations/add-booking-guest-button';
import type { InvoiceData } from '@/components/booking/invoice-modal';
import { MessageGuestButton } from '@/components/admin/operations/message-guest-button';
import { StayStateMenu } from '@/components/admin/operations/stay-state-menu';
import { stayBucket, stayBucketKey } from '@/components/admin/operations/booking-buckets';
import { BookingStatusBadge } from '@/components/admin/operations/booking-status-badge';
import { attemptStatus, methodLabel } from '@/components/admin/operations/payment-state';
import { PAGE_SIZE, paginate, parsePage, parsePageSize, Pagination, tablePager } from '@/components/admin/operations/pagination';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ reference: string }> }): Promise<Metadata> {
  const { reference } = await params;
  const t = adminT(await getAdminLocale());
  return { title: adminPageTitle(t, t('booking.metaTitle', { reference })) };
}

/** "18 Sep 2026, 14:05 UTC" in the team member's language — the clock part is the ISO string's own. */
function timestamp(iso: string, locale: AdminLocale, t: AdminT): string {
  return t('booking.timestamp', { date: lDate(iso.slice(0, 10), locale), time: iso.slice(11, 16) });
}

function coverOf(room: RoomType | null | undefined) {
  return room?.media.find((item) => item.type === 'image');
}

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { reference } = await params;
  const sp = await searchParams;
  const historyPageParam = parsePage(sp.page);
  const historyPageSizeParam = parsePageSize(sp.pageSize);
  const locale = await getAdminLocale();
  const t = adminT(locale);
  const confirmation = await bookingService.getConfirmation(reference).catch((error: unknown) => {
    if (error instanceof BookingError && error.code === 'not_found') notFound();
    throw error;
  });

  const { booking, room, ratePlan, addOns, payments } = confirmation;
  const group = booking.groupId ? await hotelRepository.getBookingGroup(booking.groupId) : null;
  const today = toIsoDate(new Date());
  const email = booking.guest.email.trim().toLowerCase();
  const [assigned, allBookings, roomTypes, hotel, bookingGuests] = await Promise.all([
    inventoryService.getBookingRoom(booking),
    hotelRepository.listBookings(),
    hotelRepository.listRooms(booking.hotelId),
    catalogService.getHotel(await getSelectedHotelSlug()),
    bookingGuestService.listForBooking(booking),
  ]);
  const adultSlots = Math.max(0, booking.adults - 1 - bookingGuests.filter((guest) => guest.category === 'adult').length);
  const childSlots = Math.max(0, booking.children - bookingGuests.filter((guest) => guest.category === 'child').length);

  const history = allBookings
    .filter((candidate) => candidate.guest.email.trim().toLowerCase() === email)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const historyRooms = await Promise.all(history.map((candidate) => inventoryService.getBookingRoom(candidate)));
  const roomByBookingId = new Map(history.map((entry, index) => [entry.id, historyRooms[index]]));
  const { pageItems: pageHistory, page: historyPage, totalPages: historyTotalPages } = paginate(
    history,
    historyPageParam,
    historyPageSizeParam,
  );
  const paymentsPager = tablePager(sp, `/admin/bookings/${reference}`, 'payments');
  const invoicesPager = tablePager(sp, `/admin/bookings/${reference}`, 'invoices');
  const { pageItems: pagePayments, page: paymentsPage, totalPages: paymentsTotalPages } = paginate(payments, paymentsPager.page, paymentsPager.pageSize);
  const invoiceRows = payments.length > 0 ? [booking] : [];
  const { pageItems: pageInvoices, page: invoicesPage, totalPages: invoicesTotalPages } = paginate(invoiceRows, invoicesPager.page, invoicesPager.pageSize);
  const roomTypeById = new Map(roomTypes.map((type) => [type.id, type]));
  const stayed = history.filter((candidate) => candidate.status === 'confirmed');
  const nightsBooked = stayed.reduce((sum, candidate) => sum + nightsBetween(candidate.checkIn, candidate.checkOut), 0);
  const spent = stayed.reduce((sum, candidate) => sum + candidate.total, 0);

  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const breakdown = ratePlan
    ? buildPriceBreakdown({ ratePlan, checkIn: booking.checkIn, addOns, nights, adults: booking.adults, children: booking.children })
    : null;
  const drifted = breakdown !== null && Math.abs(breakdown.total - booking.total) > 0.005;
  const bucket = stayBucket(booking, today);
  const canCancel = booking.status === 'confirmed' && booking.checkIn > today;
  const cancelBlockedReason =
    booking.status === 'cancelled'
      ? t('booking.cancelledNote')
      : !canCancel
        ? t('booking.stayBegunNote')
        : undefined;
  const guestName = `${booking.guest.firstName} ${booking.guest.lastName}`;
  const initials = `${booking.guest.firstName[0] ?? ''}${booking.guest.lastName[0] ?? ''}`.toUpperCase();
  const lastPayment = payments.at(-1);
  const payment = lastPayment ? attemptStatus(lastPayment.status, t) : null;
  const authorized = payments.some((attempt) => attempt.status === 'authorized');
  // The same shape the guest's own confirmation page builds — see `InvoiceModal`. Issued from
  // the desk's Actions menu, so a team member never has to open the guest's own page to print one.
  const invoice: InvoiceData = {
    details: buildInvoiceDetails(booking, room?.name ?? booking.roomTypeId, breakdown, payments, await ordersService.list(booking.hotelId)),
    reference: booking.reference,
    issuedOn: booking.createdAt.slice(0, 10),
    hotelName: hotel.name,
    hotelLocation: hotel.location,
    guestName,
    guestEmail: booking.guest.email,
    roomName: room?.name ?? booking.roomTypeId,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    nights,
    currency: booking.currency,
    lines: breakdown
      ? [
          {
            label: `${room?.name ?? booking.roomTypeId} — ${lStayRoomPriceLabel(breakdown, locale)}`,
            amount: breakdown.roomTotal,
          },
          ...breakdown.addOnLines.map((line) => ({
            label: line.quantity > 1 ? `${line.name} × ${line.quantity}` : line.name,
            amount: line.total,
          })),
        ]
      : [{ label: room?.name ?? booking.roomTypeId, amount: booking.total }],
    taxesAndFees: breakdown?.taxesAndFees ?? 0,
    total: booking.total,
    methodLabel: lastPayment ? methodLabel(lastPayment.provider, locale) : null,
    paid: authorized,
  };
  const bookingCount =
    history.length === 1
      ? t('booking.firstBooking')
      : pluralForm(locale, history.length, {
          one: t('booking.countOne', { count: history.length }),
          few: t('booking.countFew', { count: history.length }),
          many: t('booking.countMany', { count: history.length }),
          other: t('booking.countMany', { count: history.length }),
        });

  const pageHref = (
    overrides: Partial<{ page: number; pageSize: number; paymentsPage: number; invoicesPage: number }>,
  ) => {
    const next = { page: historyPage, pageSize: historyPageSizeParam, paymentsPage, invoicesPage, ...overrides };
    const query = new URLSearchParams();
    if (next.page > 1) query.set('page', String(next.page));
    if (next.pageSize !== PAGE_SIZE) query.set('pageSize', String(next.pageSize));
    if (next.paymentsPage > 1) query.set('paymentsPage', String(next.paymentsPage));
    if (next.invoicesPage > 1) query.set('invoicesPage', String(next.invoicesPage));
    const qs = query.toString();
    return `/admin/bookings/${booking.reference}${qs ? `?${qs}` : ''}`;
  };

  const paid = payments.filter((attempt) => attempt.status === 'authorized').reduce((sum, attempt) => sum + attempt.amount, 0);
  const balance = Math.max(0, booking.total - paid);
  const arrivalTime = booking.checkInTime ?? STANDARD_CHECK_IN_TIME;
  const departureTime = booking.checkOutTime ?? (booking.addOnIds.includes('addon_late') ? LATE_CHECK_OUT_TIME : STANDARD_CHECK_OUT_TIME);
  const lateCheckIn = booking.lateCheckIn ?? false;
  const lateCheckOut = booking.lateCheckOut ?? booking.addOnIds.includes('addon_late');
  const extrasTotal = breakdown ? breakdown.addOnLines.reduce((sum, line) => sum + line.total, 0) : 0;

  return (
    <AdminPage>
      <AdminPageHeader
        breadcrumbs={[{ label: t('nav.operations') }, { label: t('nav.reservations'), href: '/admin/bookings' }]}
        title={t('booking.title')}
        description={booking.reference}
        actions={
          <>
            <StayStateMenu
              reference={booking.reference}
              status={booking.status}
              stayState={booking.stayState}
              canCancel={canCancel}
              cancelBlockedReason={cancelBlockedReason}
              size="large"
            />
            <MessageGuestButton reference={booking.reference} />
            <BookingHeaderActions
              reference={booking.reference}
              checkIn={booking.checkIn}
              canCancel={canCancel}
              cancelBlockedReason={cancelBlockedReason}
              invoice={invoice}
              guestConfirmationUrl={guestAppUrl(`/booking/${encodeURIComponent(booking.reference)}`)}
            />
          </>
        }
      />

      {/* The reservation card: who, which door, and when — the three things a
          desk reads first — in one band, the way a PMS folio opens. */}
      <section aria-labelledby="reservation-heading" className="mt-6 rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="reservation-heading" className="text-display text-2xl">
              <span className="text-muted-foreground">{t('booking.reservation')} </span>
              {booking.reference}
            </h2>
          <BookingStatusBadge status={booking.status} stayState={booking.stayState} />
          {booking.status === 'cancelled' && booking.cancellationReason ? (
            <p className="mt-2 text-sm text-muted-foreground">{booking.cancellationReason}</p>
          ) : null}
            {booking.status !== 'cancelled' ? <span className={tag()}>{t(stayBucketKey[bucket])}</span> : null}
          </div>
          <p className="text-sm text-muted-foreground">{t('booking.bookedOn', { when: timestamp(booking.createdAt, locale, t) })}</p>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-main-aside lg:items-center">
          <div className="flex min-w-0 flex-wrap items-center gap-x-8 gap-y-5">
            <div className="flex min-w-0 items-center gap-4">
              <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-full bg-stone text-base font-semibold">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="text-display text-xl">{guestName}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <a href={`tel:${booking.guest.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                    <PhoneIcon className="size-4" aria-hidden="true" />
                    {booking.guest.phone}
                  </a>
                  <a href={`mailto:${booking.guest.email}`} className="inline-flex min-w-0 items-center gap-1.5 hover:text-foreground">
                    <EnvelopeIcon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{booking.guest.email}</span>
                  </a>
                </p>
              </div>
            </div>
            <div className="min-w-0">
              {assigned ? (
                <span className={pill('primary', 'min-h-10 px-4 text-sm')}>{lRoomNumber(assigned.number, locale)}</span>
              ) : (
                <span className={pill('secondary', 'min-h-10 px-4 text-sm text-muted-foreground')}>
                  {booking.status === 'cancelled' ? t('booking.released') : t('booking.notAssigned')}
                </span>
              )}
              <p className="mt-1.5 text-xs text-muted-foreground">
                {room ? (
                  <Link href={`/admin/content/rooms/${room.id}`} className="hover:text-foreground">{room.name}</Link>
                ) : (
                  booking.roomTypeId
                )}
                {assigned ? (
                  <>
                    {' · '}
                    {booking.status === 'cancelled' ? t('booking.released') : assigned.chosenByGuest ? t('booking.chosenByGuest') : t('booking.assignedAuto')}
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">{t('ops.thCheckIn')}</p>
                <p className="text-display mt-0.5 text-xl">{lDate(booking.checkIn, locale)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('ops.thCheckOut')}</p>
                <p className="text-display mt-0.5 text-xl">{lDate(booking.checkOut, locale)}</p>
              </div>
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-3 text-sm">
              <div className="flex gap-1.5"><dt className="text-muted-foreground">{t('booking.nightsLabel')}</dt><dd className="font-medium">{nights}</dd></div>
              <div className="flex gap-1.5"><dt className="text-muted-foreground">{t('booking.adults')}</dt><dd className="font-medium">{booking.adults}</dd></div>
              <div className="flex gap-1.5"><dt className="text-muted-foreground">{t('booking.children')}</dt><dd className="font-medium">{booking.children}</dd></div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <p><span className="text-muted-foreground">{t('booking.arrivalTime')}:</span> {arrivalTime}{lateCheckIn ? ` · ${t('booking.lateCheckIn')}` : null}</p>
              <p><span className="text-muted-foreground">{t('booking.departureTime')}:</span> {departureTime}{lateCheckOut ? ` · ${t('booking.lateCheckOut')}` : null}</p>
            </div>
            <EditBookingStayButton reference={booking.reference} checkIn={booking.checkIn} checkOut={booking.checkOut}
              checkInTime={arrivalTime} checkOutTime={departureTime} roomTypeId={booking.roomTypeId}
              lateCheckIn={lateCheckIn} lateCheckOut={lateCheckOut}
              roomNumber={assigned?.number ?? null} currency={booking.currency} canEdit={booking.status === 'confirmed' && booking.checkOut > today} />
          </div>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Card id="guests-heading" title={t('booking.guests')}>
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-stone text-sm font-semibold">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{guestName}</p>
              <p className="truncate text-xs text-muted-foreground">{booking.guest.email}</p>
            </div>
            <span className={tag('shrink-0')}>{t('booking.primaryGuest')}</span>
          </div>
          {bookingGuests.length > 0 ? (
            <div className="mt-4 space-y-3">
              {bookingGuests.map((guest) => {
                const guestInitials = `${guest.firstName[0] ?? ''}${guest.lastName[0] ?? ''}`.toUpperCase();
                return (
                  <div key={guest.id} className="flex min-w-0 items-center gap-3 border-t border-border pt-3">
                    <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-stone text-sm font-semibold">{guestInitials}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{guest.firstName} {guest.lastName}</p>
                      {guest.email || guest.phone ? (
                        <p className="truncate text-xs text-muted-foreground">{[guest.email, guest.phone].filter(Boolean).join(' · ')}</p>
                      ) : null}
                    </div>
                    <span className={tag('shrink-0')}>{t(guest.category === 'adult' ? 'booking.adultGuest' : 'booking.childGuest')}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
          {booking.status === 'confirmed' && adultSlots + childSlots > 0 ? (
            <AddBookingGuestButton reference={booking.reference} adultSlots={adultSlots} childSlots={childSlots} />
          ) : booking.status === 'confirmed' ? (
            <p className="mt-5 border-t border-border pt-5 text-sm text-muted-foreground">{t('booking.guestAllNamed')}</p>
          ) : null}
          <Fields className="mt-5 border-t border-border pt-5">
            <Field label={t('booking.adults')}>{booking.adults}</Field>
            <Field label={t('booking.children')}>{booking.children}</Field>
          </Fields>
          <Section title={t('booking.withThisHotel')}>
            <p className="-mt-2 mb-3 text-xs text-muted-foreground">{bookingCount}</p>
            <Fields>
              <Field label={t('booking.staysBooked')}>{stayed.length}</Field>
              <Field label={t('booking.nightsBooked')}>{nightsBooked}</Field>
              <Field label={t('booking.totalSpent')}>{lMoney(spent, booking.currency, locale)}</Field>
            </Fields>
          </Section>
        </Card>

        <Card id="info-heading" title={t('booking.bookingInfo')}>
          <dl className="divide-y divide-border text-sm">
            <Row label={t('booking.source')}>{t('booking.sourceDirect')}</Row>
            <Row label={t('booking.roomType')}>
              {room ? <Link href={`/admin/content/rooms/${room.id}`} className="hover:text-accent-strong">{room.name}</Link> : booking.roomTypeId}
            </Row>
            <Row label={t('booking.ratePlan')}>
              {ratePlan ? ratePlan.name : '—'}
              {breakdown ? (
                <Sub>
                  {lNightlyPrice(breakdown, locale)} {t('booking.perNight')}
                </Sub>
              ) : null}
            </Row>
            {group ? (
              <Row label={t('groups.thName')}>
                <Link href={`/admin/groups/${group.id}`} className="hover:text-accent-strong">
                  {group.name}
                </Link>
              </Row>
            ) : null}
            <Row label={t('booking.payment')}>
              {lastPayment && payment ? (
                <>
                  <span className="inline-flex items-center gap-1.5 text-foreground">
                    <payment.icon weight="fill" className={cn('size-4', payment.tone)} aria-hidden="true" />
                    {payment.label}
                  </span>
                  <Sub>{methodLabel(lastPayment.provider, locale)}</Sub>
                </>
              ) : (
                <span className="text-muted-foreground">{t('ops.noAttempt')}</span>
              )}
            </Row>
            <Row label={t('booking.extras')}>
              {addOns.length === 0 ? (
                <span className="text-muted-foreground">{t('booking.noExtras')}</span>
              ) : (
                <ul className="grid gap-1.5">
                  {addOns.map((addOn) => (
                    <li key={addOn.id} className="flex min-w-0 gap-2">
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                      <span className="min-w-0">
                        {addOn.name}
                        <Sub>
                          {lMoney(addOn.price, addOn.currency, locale)} {lPricingUnit(addOn.pricingUnit, locale)}
                        </Sub>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Row>
          </dl>
        </Card>

        <Card id="balance-heading" title={t('booking.balance')} className="lg:col-span-2 xl:col-span-1">
          {/* Stacked, never side by side: a currency with a prefix and cents
              ("US$1,266.00") does not fit three abreast, and a folio's money is
              never worth an ellipsis. Debit above, credit below, the balance
              last and boxed. */}
          <dl className="grid gap-1.5">
            <Stat label={t('booking.amount')}>{lMoney(booking.total, booking.currency, locale)}</Stat>
            <Stat label={t('booking.paid')} sign="minus">{lMoney(paid, booking.currency, locale)}</Stat>
            <Stat label={t('booking.balanceDue')} tone={balance === 0 ? 'success' : 'warning'}>
              {lMoney(balance, booking.currency, locale)}
            </Stat>
          </dl>
          {breakdown ? (
            <>
              <p className="mt-5 text-xs text-muted-foreground">{t('booking.balanceIncluded')}</p>
              <dl className="mt-2 grid gap-1.5">
                <Stat label={t('booking.taxesAndFees')}>{lMoney(breakdown.taxesAndFees, breakdown.currency, locale)}</Stat>
                <Stat label={t('booking.extrasTotal')}>{lMoney(extrasTotal, breakdown.currency, locale)}</Stat>
              </dl>
            </>
          ) : null}
          <Section title={t('booking.priceSummary')}>
            {breakdown ? (
              <dl className="grid gap-2 text-sm">
                <Line label={lStayRoomPriceLabel(breakdown, locale)}>
                  {lMoney(breakdown.roomTotal, breakdown.currency, locale)}
                </Line>
                {breakdown.addOnLines.map((line) => (
                  <Line key={line.addOnId} label={`${line.name}${line.quantity > 1 ? ` × ${line.quantity}` : ''}`}>
                    {lMoney(line.total, breakdown.currency, locale)}
                  </Line>
                ))}
                <Line label={t('booking.taxesAndFees')}>{lMoney(breakdown.taxesAndFees, breakdown.currency, locale)}</Line>
              </dl>
            ) : null}
            <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-border pt-3">
              <span className="font-medium">{t('booking.totalAgreed')}</span>
              <span className="text-display text-2xl">{lMoney(booking.total, booking.currency, locale)}</span>
            </div>
            {drifted ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {t('booking.drifted', { total: lMoney(breakdown!.total, booking.currency, locale) })}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">{t('booking.demoPayments')}</p>
          </Section>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card id="payments-heading" title={t('booking.payments')} flush>
          <div className="overflow-hidden rounded-b-[18px]">
            <TableCard caption={t('booking.payments')} className="min-w-full" attached>
              <thead>
                <tr className="border-b border-border">
                  <Th>{t('accounting.thMethod')}</Th>
                  <Th>{t('ops.thStatus')}</Th>
                  <Th className="text-right">{t('accounting.thAmount')}</Th>
                </tr>
              </thead>
              <tbody>
                {pagePayments.map((attempt) => {
                  const status = attemptStatus(attempt.status, t);
                  return (
                    <tr key={attempt.id} className="border-b border-border last:border-b-0">
                      <Td className="whitespace-nowrap">{methodLabel(attempt.provider, locale)}</Td>
                      <Td>
                        <span className="inline-flex items-center gap-1.5 font-medium text-foreground whitespace-nowrap">
                          <status.icon weight="fill" className={cn('size-4 shrink-0', status.tone)} aria-hidden="true" />
                          {status.label}
                        </span>
                      </Td>
                      <Td className="text-right tabular-nums whitespace-nowrap">
                        {lMoney(attempt.amount, attempt.currency, locale)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableCard>
            <Pagination
              attached
              page={paymentsPage}
              totalPages={paymentsTotalPages}
              total={payments.length}
              pageSize={paymentsPager.pageSize}
              hrefFor={paymentsPager.hrefFor}
              pageSizeHrefFor={paymentsPager.pageSizeHrefFor}
            />
          </div>
        </Card>

        {payments.length > 0 ? (
          <Card id="invoices-heading" title={t('booking.invoices')} flush>
            <div className="overflow-hidden rounded-b-[18px]">
              <TableCard caption={t('booking.invoices')} className="min-w-full" attached>
                <thead>
                  <tr className="border-b border-border">
                    <Th>{t('booking.thInvoice')}</Th>
                    <Th>{t('ops.thStatus')}</Th>
                    <Th className="text-right">{t('accounting.thAmount')}</Th>
                    <Th className="sr-only">{t('booking.viewInvoice')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {pageInvoices.map((invoiceBooking) => (
                    <tr key={invoiceBooking.id} className="relative border-b border-border transition-colors last:border-b-0 hover:bg-stone/50">
                      <Td className="whitespace-nowrap font-medium">INV-{invoiceBooking.reference}</Td>
                      <Td>
                        {payments.some((attempt) => attempt.status === 'authorized') ? (
                          <span className="inline-flex items-center gap-1.5 font-medium whitespace-nowrap text-success">
                            <CheckIcon className="size-4 shrink-0" aria-hidden="true" />
                            {t('ops.paymentAuthorized')}
                          </span>
                        ) : (
                          <span className="whitespace-nowrap text-muted-foreground">{t('ops.awaitingPayment')}</span>
                        )}
                      </Td>
                      <Td className="text-right tabular-nums whitespace-nowrap">
                        {lMoney(invoiceBooking.total, invoiceBooking.currency, locale)}
                      </Td>
                      <Td className="text-right whitespace-nowrap">
                        {/* Stretched: the row opens the invoice from anywhere
                            in it, not only this link's own text. */}
                        <a
                          href={guestAppUrl(`/booking/${encodeURIComponent(invoiceBooking.reference)}`) ?? '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="relative z-10 inline-flex items-center gap-1 text-sm font-medium hover:text-accent-strong before:absolute before:inset-0"
                        >
                          {t('booking.viewInvoice')}
                          <ArrowTopRightOnSquareIcon className="size-3.5" aria-hidden="true" />
                        </a>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableCard>
              <Pagination
                attached
                page={invoicesPage}
                totalPages={invoicesTotalPages}
                total={invoiceRows.length}
                pageSize={invoicesPager.pageSize}
                hrefFor={invoicesPager.hrefFor}
                pageSizeHrefFor={invoicesPager.pageSizeHrefFor}
              />
            </div>
          </Card>
        ) : null}
      </div>

      <Card id="history-heading" title={t('booking.guestBookings')} className="mt-6" flush>
        <div className="overflow-hidden rounded-b-[18px]">
          <TableCard caption={t('booking.historyCaption', { email: booking.guest.email })} className="min-w-[56rem]" attached>
            <thead>
              <tr className="border-b border-border">
                <Th>{t('ops.thRoom')}</Th>
                <Th>{t('ops.thBookingNumber')}</Th>
                <Th>{t('ops.thBooked')}</Th>
                <Th>{t('ops.thCheckIn')}</Th>
                <Th>{t('ops.thCheckOut')}</Th>
                <Th>{t('ops.thGuests')}</Th>
                <Th className="text-right">{t('ops.thTotal')}</Th>
                <Th>{t('ops.thStatus')}</Th>
              </tr>
            </thead>
            <tbody>
              {pageHistory.map((entry) => (
                <HistoryRow
                  key={entry.id}
                  booking={entry}
                  roomType={roomTypeById.get(entry.roomTypeId)}
                  roomNumber={roomByBookingId.get(entry.id)?.number}
                  current={entry.id === booking.id}
                  locale={locale}
                  t={t}
                />
              ))}
            </tbody>
          </TableCard>
          <Pagination
            attached
            page={historyPage}
            totalPages={historyTotalPages}
            total={history.length}
            pageSize={historyPageSizeParam}
            hrefFor={(p) => pageHref({ page: p })}
            pageSizeHrefFor={(size) => pageHref({ pageSize: size, page: 1 })}
          />
        </div>
      </Card>
    </AdminPage>
  );
}

function HistoryRow({
  booking,
  roomType,
  roomNumber,
  current,
  locale,
  t,
}: {
  booking: Booking;
  roomType: RoomType | undefined;
  roomNumber: string | undefined;
  current: boolean;
  locale: AdminLocale;
  t: AdminT;
}) {
  const cover = coverOf(roomType);
  return (
    <tr className={cn('border-b border-border last:border-b-0', current && 'bg-stone/40')}>
      <Td>
        <span className="flex items-center gap-3">
          {cover ? (
            <img src={cover.url} alt="" className="size-14 shrink-0 rounded-[18px] bg-stone object-cover" />
          ) : (
            <span aria-hidden="true" className="size-14 shrink-0 rounded-[18px] bg-stone" />
          )}
          <span className="min-w-0">
            <span className="block font-medium">{roomType?.name ?? booking.roomTypeId}</span>
            <span className="block text-xs text-muted-foreground">
              {roomNumber ? lRoomNumber(roomNumber, locale) : t('booking.notAssigned')}
            </span>
          </span>
        </span>
      </Td>
      <Td className="whitespace-nowrap">
        {current ? (
          <span className="font-medium">
            {booking.reference}
            <span className="block text-xs font-normal text-muted-foreground">{t('booking.thisBooking')}</span>
          </span>
        ) : (
          <Link href={`/admin/bookings/${booking.reference}`} className="font-medium hover:text-accent-strong">
            {booking.reference}
          </Link>
        )}
      </Td>
      <Td className="whitespace-nowrap">{lDateShort(booking.createdAt.slice(0, 10), locale)}</Td>
      <Td className="whitespace-nowrap">{lDateShort(booking.checkIn, locale)}</Td>
      <Td className="whitespace-nowrap">{lDateShort(booking.checkOut, locale)}</Td>
      <Td className="whitespace-nowrap">{lGuests(booking.adults, booking.children, locale)}</Td>
      <Td className="text-right font-medium whitespace-nowrap tabular-nums">
        {lMoney(booking.total, booking.currency, locale)}
      </Td>
      <Td>
        <BookingStatusBadge status={booking.status} stayState={booking.stayState} />
      </Td>
    </tr>
  );
}

function Card({
  id,
  title,
  action,
  className,
  flush = false,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  className?: string;
  /** A table inside: the title keeps the card's padding, the body runs edge to edge under a rule. */
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn('min-w-0 overflow-hidden rounded-[18px] bg-card shadow-soft', !flush && 'p-5 sm:p-6', className)}>
      <div className={cn('flex items-center justify-between gap-4', flush && 'border-b border-border px-5 py-4 sm:px-6')}>
        <h2 id={id} className="text-base font-medium">
          {title}
        </h2>
        {action}
      </div>
      <div className={cn(!flush && 'mt-4')}>{children}</div>
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

/** One labelled row of the booking-info list: the label in the gutter, the value beside it. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium">{children}</dd>
    </div>
  );
}

/** One line of a folio's money — the label left, the full figure right, never clipped; `sign` marks a credit. */
function Stat({ label, tone, sign, children }: { label: string; tone?: 'success' | 'warning'; sign?: 'minus'; children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-3 rounded-2xl border px-3.5 py-2.5',
        tone === 'success' ? 'border-success/40 bg-success/5' : tone === 'warning' ? 'border-warning/40 bg-warning/5' : 'border-border bg-stone/40',
      )}
    >
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn('shrink-0 font-semibold tabular-nums whitespace-nowrap', tone === 'success' && 'text-success', tone === 'warning' && 'text-warning')}>
        {sign === 'minus' ? '− ' : ''}
        {children}
      </dd>
    </div>
  );
}
