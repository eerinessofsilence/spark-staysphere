import type { Metadata } from 'next';
import Link from 'next/link';
import { CircleSlash, Plug, RefreshCw } from 'lucide-react';
import { defaultRoomFilters } from '@/lib/application/catalog-service';
import {
  bookingService,
  catalogService,
  demoControl,
  DEMO_HOTEL_SLUG,
  hotelRepository,
} from '@/lib/application/container';
import { parseCriteria } from '@/lib/application/search-params';
import type { IntegrationStatus, RoomStatus } from '@/lib/domain/schemas';
import {
  formatDate,
  formatDateRange,
  formatGuests,
  formatMoney,
  formatPricingUnit,
  viewLabels,
} from '@/lib/formatting';
import { AddOnToggle, ResetDemoButton, RoomStatusControl } from '@/components/admin/room-controls';
import { StatusBadge } from '@/components/rooms/status-badge';
import { Eyebrow } from '@/components/site/eyebrow';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';

export const metadata: Metadata = {
  title: 'Hotel admin demo — Asteria Cove | SPARK StaySphere 360',
};

/** Demo state is process-local, so this page must never be cached. */
export const dynamic = 'force-dynamic';

const adapterLabels: Record<IntegrationStatus['adapter'], string> = {
  pms: 'Property management system',
  channel_manager: 'Channel manager',
  booking_engine: 'Booking engine',
  payment: 'Payment provider',
  crm: 'CRM',
};

export default async function AdminPage() {
  const criteria = parseCriteria({});
  const [{ hotel, offers }, integrations, bookings] = await Promise.all([
    catalogService.search(DEMO_HOTEL_SLUG, criteria, {
      ...defaultRoomFilters,
      // Show every room type, including any that cannot sleep the default party.
      includeSoldOut: true,
    }),
    demoControl.listIntegrationStatuses(),
    hotelRepository.listBookings(),
  ]);

  const rooms = await hotelRepository.listRooms(hotel.id);
  const allOffers = rooms.map((room) => ({
    room,
    offer: offers.find((candidate) => candidate.room.id === room.id) ?? null,
  }));

  const overrides = await Promise.all(
    rooms.map(async (room) => [room.id, await demoControl.getRoomStatusOverride(room.id)] as const),
  );
  const overrideMap = new Map<string, RoomStatus | null>(overrides);

  const addOns = await hotelRepository.listAddOns(hotel.id);
  const confirmations = await Promise.all(
    bookings.map((booking) => bookingService.getConfirmation(booking.reference)),
  );

  const revenue = bookings.reduce((sum, booking) => sum + booking.total, 0);

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Hotel admin · demo</Eyebrow>
            <h1 className="text-display mt-3 text-4xl sm:text-5xl">{hotel.name} operations</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Controls below write to the in-memory demo state only. A production admin writes
              through the PMS adapter, and inventory stays owned by the PMS or channel manager.
            </p>
          </div>
          <ResetDemoButton />
        </header>

        <dl className="mt-8 grid gap-4 sm:grid-cols-3">
          <Metric label="Room types" value={String(rooms.length)} />
          <Metric label="Bookings this session" value={String(bookings.length)} />
          <Metric label="Demo revenue" value={formatMoney(revenue, hotel.currency)} />
        </dl>

        <section aria-labelledby="rooms-heading" className="mt-12">
          <h2 id="rooms-heading" className="text-display text-2xl">
            Rooms and availability
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Status is simulated per date. Setting an override forces that status for every date and
            immediately changes what guests see in the catalog.
          </p>

          <div className="mt-5 overflow-x-auto rounded-3xl border border-border bg-card">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <caption className="sr-only">
                Room types with their current demo status and availability override
              </caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <Th>Room type</Th>
                  <Th>Specs</Th>
                  <Th>Rate</Th>
                  <Th>Status for the demo stay</Th>
                  <Th>Override</Th>
                </tr>
              </thead>
              <tbody>
                {allOffers.map(({ room, offer }) => (
                  <tr key={room.id} className="border-b border-border last:border-b-0">
                    <Td>
                      <Link href={`/rooms/${room.slug}`} className="font-medium hover:text-cyan-dark">
                        {room.name}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{room.id}</span>
                    </Td>
                    <Td className="text-muted-foreground">
                      {room.areaM2} m² · {viewLabels[room.view]} · sleeps {room.capacity}
                    </Td>
                    <Td>
                      {offer
                        ? `${formatMoney(offer.ratePlan.nightlyPrice, offer.ratePlan.currency)}/night`
                        : '—'}
                    </Td>
                    <Td>
                      {offer ? (
                        <StatusBadge status={offer.status} remaining={offer.remaining} />
                      ) : (
                        <span className="text-muted-foreground">Not sellable for this party</span>
                      )}
                    </Td>
                    <Td className="w-64">
                      <RoomStatusControl
                        roomTypeId={room.id}
                        roomName={room.name}
                        value={overrideMap.get(room.id) ?? 'auto'}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="addons-heading" className="mt-12">
          <h2 id="addons-heading" className="text-display text-2xl">
            Add-ons
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Withdrawing an add-on removes it from the room detail page and the booking flow, and
            drops it from any quote that still references it.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {addOns.map((addOn) => (
              <div key={addOn.id} className="rounded-3xl border border-border bg-card p-5">
                <h3 className="font-semibold">{addOn.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{addOn.description}</p>
                <p className="mt-3 text-sm font-medium">
                  {formatMoney(addOn.price, addOn.currency)}{' '}
                  <span className="font-normal text-muted-foreground">
                    {formatPricingUnit(addOn.pricingUnit)}
                  </span>
                </p>
                <div className="mt-3 border-t border-border pt-3">
                  <AddOnToggle addOnId={addOn.id} addOnName={addOn.name} enabled={addOn.enabled} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="bookings-heading" className="mt-12">
          <h2 id="bookings-heading" className="text-display text-2xl">
            Bookings in this demo session
          </h2>

          {confirmations.length === 0 ? (
            <div className="mt-5 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-card p-10 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-canvas text-muted-foreground">
                <CircleSlash className="size-6" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-display text-xl">No bookings yet</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Complete a demo booking and it will appear here until the server restarts.
                </p>
              </div>
              <Link
                href="/rooms"
                className="flex min-h-11 items-center rounded-xl bg-cyan px-5 text-sm font-semibold text-ink hover:bg-cyan/85"
              >
                Make a demo booking
              </Link>
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-3xl border border-border bg-card">
              <table className="w-full min-w-[52rem] border-collapse text-sm">
                <caption className="sr-only">Demo bookings created in this server process</caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    <Th>Reference</Th>
                    <Th>Guest</Th>
                    <Th>Room</Th>
                    <Th>Stay</Th>
                    <Th>Services</Th>
                    <Th>Total</Th>
                    <Th>Payment</Th>
                  </tr>
                </thead>
                <tbody>
                  {confirmations.map(({ booking, room, addOns: bookingAddOns, payments }) => (
                    <tr key={booking.id} className="border-b border-border last:border-b-0">
                      <Td>
                        <Link
                          href={`/booking/${booking.reference}`}
                          className="font-mono font-medium hover:text-cyan-dark"
                        >
                          {booking.reference}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {formatDate(booking.createdAt.slice(0, 10))}
                        </span>
                      </Td>
                      <Td>
                        {booking.guest.firstName} {booking.guest.lastName}
                        <span className="block text-xs text-muted-foreground">
                          {booking.guest.email}
                        </span>
                      </Td>
                      <Td>{room?.name ?? booking.roomTypeId}</Td>
                      <Td className="whitespace-nowrap">
                        {formatDateRange(booking.checkIn, booking.checkOut)}
                        <span className="block text-xs text-muted-foreground">
                          {formatGuests(booking.adults, booking.children)}
                        </span>
                      </Td>
                      <Td className="text-muted-foreground">
                        {bookingAddOns.length
                          ? bookingAddOns.map((addOn) => addOn.name).join(', ')
                          : '—'}
                      </Td>
                      <Td className="font-medium tabular-nums">
                        {formatMoney(booking.total, booking.currency)}
                      </Td>
                      <Td>
                        <span
                          className={
                            payments.some((payment) => payment.status === 'authorized')
                              ? 'text-success'
                              : 'text-warning'
                          }
                        >
                          {payments.some((payment) => payment.status === 'authorized')
                            ? 'Demo authorized'
                            : 'No attempt'}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="integrations-heading" className="mt-12 mb-4">
          <h2 id="integrations-heading" className="text-display text-2xl">
            Integrations
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Every adapter below runs a mock implementation. None of them is connected to a real PMS,
            channel manager, payment provider, or CRM.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {integrations.map((integration) => (
              <li
                key={integration.adapter}
                className="rounded-3xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{adapterLabels[integration.adapter]}</h3>
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-canvas text-muted-foreground">
                    <Plug className="size-4" aria-hidden="true" />
                  </span>
                </div>
                <dl className="mt-4 grid gap-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Mode</dt>
                    <dd className="font-medium capitalize">{integration.mode}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Connected</dt>
                    <dd
                      className={
                        integration.connected ? 'font-medium text-success' : 'font-medium text-warning'
                      }
                    >
                      {integration.connected ? 'Yes — mock' : 'No'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Last sync</dt>
                    <dd className="flex items-center gap-1.5 font-medium">
                      <RefreshCw className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      {integration.lastSyncAt ? formatDate(integration.lastSyncAt.slice(0, 10)) : 'Never'}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <dt className="eyebrow text-muted-foreground">{label}</dt>
      <dd className="text-display mt-2 text-3xl">{value}</dd>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className ?? ''}`}>{children}</td>;
}
