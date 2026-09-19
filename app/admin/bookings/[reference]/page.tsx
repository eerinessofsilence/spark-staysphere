import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PushPin } from '@phosphor-icons/react/dist/ssr';
import { CheckIcon, EnvelopeIcon, PhoneIcon, TableCellsIcon } from '@heroicons/react/24/outline';
import { BookingError } from '@/lib/application/booking-service';
import { bookingService, hotelRepository, inventoryService } from '@/lib/application/container';
import { toIsoDate } from '@/lib/application/search-params';
import { buildPriceBreakdown, nightsBetween } from '@/lib/domain/pricing';
import type { Booking, RoomType } from '@/lib/domain/schemas';
import type { AdminLocale } from '@/lib/i18n/admin/locale';
import { getAdminLocale } from '@/lib/i18n/admin/server';
import { adminPageTitle, adminT, type AdminT } from '@/lib/i18n/admin/translate';
import {
  lBed,
  lDate,
  lDateShort,
  lGuests,
  lMoney,
  lNights,
  lPricingUnit,
  lRoomNumber,
  lView,
} from '@/lib/i18n/format';
import { pluralForm } from '@/lib/i18n/plural';
import { pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { BookingActions } from '@/components/admin/operations/booking-actions';
import { stayBucket, stayBucketKey } from '@/components/admin/operations/booking-buckets';
import { BookingStatusBadge } from '@/components/admin/operations/booking-status-badge';
import { attemptStatus, methodLabel } from '@/components/admin/operations/payment-state';
import { paginate, parsePage, Pagination, simplePageHref } from '@/components/admin/operations/pagination';
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
  const page = parsePage((await searchParams).page);
  const locale = await getAdminLocale();
  const t = adminT(locale);
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
  const roomByBookingId = new Map(history.map((entry, index) => [entry.id, historyRooms[index]]));
  const { pageItems: pageHistory, page: historyPage, totalPages: historyTotalPages } = paginate(history, page);
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
      ? t('booking.cancelledNote')
      : !canCancel
        ? t('booking.stayBegunNote')
        : null;
  const guestName = `${booking.guest.firstName} ${booking.guest.lastName}`;
  const initials = `${booking.guest.firstName[0] ?? ''}${booking.guest.lastName[0] ?? ''}`.toUpperCase();
  const cover = coverOf(room);
  const lastPayment = payments.at(-1);
  const payment = lastPayment ? attemptStatus(lastPayment.status, t) : null;
  const bookingCount =
    history.length === 1
      ? t('booking.firstBooking')
      : pluralForm(locale, history.length, {
          one: t('booking.countOne', { count: history.length }),
          few: t('booking.countFew', { count: history.length }),
          many: t('booking.countMany', { count: history.length }),
          other: t('booking.countMany', { count: history.length }),
        });

  return (
    <AdminPage>
      <AdminPageHeader
        breadcrumbs={[{ label: t('nav.operations') }, { label: t('nav.reservations'), href: '/admin/bookings' }]}
        title={t('booking.title')}
        description={booking.reference}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-12">
        <Card id="guest-heading" title={t('booking.guest')} className="xl:col-span-3">
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="grid size-16 shrink-0 place-items-center rounded-full bg-stone text-lg font-semibold"
            >
              {initials}
            </span>
            <div className="min-w-0">
              <p className="text-display truncate text-2xl">{guestName}</p>
              <p className="text-sm text-muted-foreground">{bookingCount}</p>
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

          <Section title={t('booking.thisStay')}>
            <Fields>
              <Field label={t('booking.adults')}>{booking.adults}</Field>
              <Field label={t('booking.children')}>{booking.children}</Field>
            </Fields>
          </Section>

          <Section title={t('booking.withThisHotel')}>
            <Fields>
              <Field label={t('booking.staysBooked')}>{stayed.length}</Field>
              <Field label={t('booking.nightsBooked')}>{nightsBooked}</Field>
              <Field label={t('booking.totalSpent')}>{lMoney(spent, booking.currency, locale)}</Field>
            </Fields>
          </Section>
        </Card>

        <Card
          id="booking-heading"
          title={t('booking.booking')}
          className="lg:order-first lg:col-span-2 xl:order-none xl:col-span-6"
        >
          <div className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={booking.status} stayState={booking.stayState} />
            {booking.status !== 'cancelled' ? <span className={tag()}>{t(stayBucketKey[bucket])}</span> : null}
          </div>
          <p className="text-display mt-4 text-3xl">
            <span className="text-muted-foreground">{t('booking.booking')} </span>
            {booking.reference}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('booking.bookedOn', { when: timestamp(booking.createdAt, locale, t) })}
          </p>

          <Fields className="mt-6 sm:grid-cols-3">
            <Field label={t('booking.roomType')}>
              {room ? (
                <Link href={`/admin/content/rooms/${room.id}`} className="hover:text-accent-strong">
                  {room.name}
                </Link>
              ) : (
                booking.roomTypeId
              )}
            </Field>
            <Field label={t('ops.thRoom')}>
              {assigned ? (
                <>
                  {lRoomNumber(assigned.number, locale)}
                  <Sub>
                    {booking.status === 'cancelled' ? (
                      t('booking.released')
                    ) : assigned.chosenByGuest ? (
                      <span className="inline-flex items-center gap-1">
                        <PushPin weight="fill" className="size-3.5 text-foreground" aria-hidden="true" />
                        {t('booking.chosenByGuest')}
                      </span>
                    ) : (
                      t('booking.assignedAuto')
                    )}
                  </Sub>
                </>
              ) : (
                <span className="text-muted-foreground">
                  {booking.status === 'cancelled' ? t('booking.released') : t('booking.notAssigned')}
                </span>
              )}
            </Field>
            <Field label={t('booking.rate')}>
              {breakdown ? (
                <>
                  {lMoney(breakdown.nightlyPrice, breakdown.currency, locale)}
                  <span className="font-normal text-muted-foreground"> {t('booking.perNight')}</span>
                </>
              ) : (
                '—'
              )}
              {ratePlan ? <Sub>{ratePlan.name}</Sub> : null}
            </Field>
            <Field label={t('ops.thGuests')}>{lGuests(booking.adults, booking.children, locale)}</Field>
            <Field label={t('booking.payment')}>
              {lastPayment && payment ? (
                <>
                  <span className={cn('inline-flex items-center gap-1.5', payment.tone)}>
                    <payment.icon weight="fill" className="size-4" aria-hidden="true" />
                    {payment.label}
                  </span>
                  <Sub>{methodLabel(lastPayment.provider, locale)}</Sub>
                </>
              ) : (
                <span className="text-muted-foreground">{t('ops.noAttempt')}</span>
              )}
            </Field>
            <Field label={t('booking.duration')}>{lNights(nights, locale)}</Field>
            <Field label={t('ops.thCheckIn')}>{lDate(booking.checkIn, locale)}</Field>
            <Field label={t('ops.thCheckOut')}>{lDate(booking.checkOut, locale)}</Field>
          </Fields>

          <Section title={t('booking.extras')}>
            {addOns.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('booking.noExtras')}</p>
            ) : (
              <ul className="grid gap-2 text-sm sm:grid-cols-2">
                {addOns.map((addOn) => (
                  <li key={addOn.id} className="flex min-w-0 gap-2">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="font-medium">{addOn.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {lMoney(addOn.price, addOn.currency, locale)} {lPricingUnit(addOn.pricingUnit, locale)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <div className="mt-6 flex flex-wrap items-start justify-between gap-4 border-t border-border pt-5">
            <Link href={`/admin/front-desk?from=${booking.checkIn}`} className={pill('ghost')}>
              <TableCellsIcon className="size-4" aria-hidden="true" />
              {t('booking.showOnFrontDesk')}
            </Link>
            <BookingActions reference={booking.reference} canCancel={canCancel} note={note} />
          </div>
        </Card>

        <Card
          id="room-heading"
          title={t('ops.thRoom')}
          className="xl:col-span-3"
          action={
            room ? (
              <Link href={`/admin/content/rooms/${room.id}`} className="text-sm text-muted-foreground hover:text-foreground">
                {t('booking.editRoom')}
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
              className="aspect-[4/3] w-full rounded-[14px] bg-stone object-cover"
            />
          ) : (
            <div className="grid aspect-[4/3] place-items-center rounded-[14px] bg-stone text-sm text-muted-foreground">
              {t('booking.noPhoto')}
            </div>
          )}
          {room ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              <li className={tag()}>{t('booking.area', { area: room.areaM2 })}</li>
              <li className={tag()}>{lBed(room.bedType, locale)}</li>
              <li className={tag()}>{t('booking.sleeps', { count: room.capacity })}</li>
              <li className={tag()}>{lView(room.view, locale)}</li>
            </ul>
          ) : null}

          <Section title={t('booking.priceSummary')}>
            {breakdown ? (
              <dl className="grid gap-2 text-sm">
                <Line label={`${lMoney(breakdown.nightlyPrice, breakdown.currency, locale)} × ${lNights(nights, locale)}`}>
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

      <section aria-labelledby="history-heading" className="mt-10">
        <h2 id="history-heading" className="text-display text-2xl">
          {t('booking.guestBookings')}
        </h2>
        <div className="mt-4 overflow-hidden rounded-[18px] bg-card shadow-soft">
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
            hrefFor={simplePageHref(`/admin/bookings/${booking.reference}`)}
          />
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
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn('min-w-0 rounded-[18px] bg-card p-5 shadow-soft sm:p-6', className)}>
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
