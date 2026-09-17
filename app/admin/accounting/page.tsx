import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowCounterClockwise, CheckCircle, Clock, MinusCircle, Receipt, XCircle } from '@phosphor-icons/react/dist/ssr';
import { buildLedger, type LedgerState } from '@/lib/application/accounting';
import { catalogService, hotelRepository } from '@/lib/application/container';
import { getSelectedHotelSlug } from '@/lib/application/hotel-context';
import { formatDateShort, formatMoney } from '@/lib/formatting';
import { pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Meter, Metric } from '@/components/admin/operations/metric-card';
import { methodLabel } from '@/components/admin/operations/payment-state';
import { SampleBookingsButton } from '@/components/admin/operations/sample-bookings-button';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';

export const metadata: Metadata = { title: 'Accounting — Hotel admin | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

/** Status is never colour alone: a filled mark and the words, per DESIGN_SYSTEM.md rule 10. */
const states: Record<LedgerState, { label: string; tone: string; icon: typeof CheckCircle }> = {
  collected: { label: 'Collected', tone: 'text-success', icon: CheckCircle },
  awaiting: { label: 'Awaiting payment', tone: 'text-warning', icon: Clock },
  declined: { label: 'Declined', tone: 'text-danger', icon: XCircle },
  owed_back: { label: 'Owed back', tone: 'text-danger', icon: ArrowCounterClockwise },
  void: { label: 'Cancelled, nothing paid', tone: 'text-muted-foreground', icon: MinusCircle },
};

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export default async function AccountingPage() {
  const [hotel, allBookings] = await Promise.all([
    catalogService.getHotel(await getSelectedHotelSlug()),
    hotelRepository.listBookings(),
  ]);
  const bookings = allBookings.filter((booking) => booking.hotelId === hotel.id);
  const entries = await Promise.all(
    bookings.map(async (booking) => ({ booking, payments: await hotelRepository.listPaymentAttempts(booking.id) })),
  );
  const ledger = buildLedger(entries);
  const money = (value: number) => formatMoney(value, hotel.currency);
  const unpaid = ledger.counts.awaiting + ledger.counts.declined;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Accounting"
        actions={<span className={tag()}>Demo payments — nothing is charged</span>}
      />

      {ledger.rows.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-border bg-card p-10 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-stone text-muted-foreground">
            <Receipt weight="fill" className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-display text-2xl">No payments yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Complete a demo booking on the guest site and its payment shows up here, or add sample stays to see
              every kind of payment at once.
            </p>
          </div>
          <div className="flex flex-wrap items-start justify-center gap-2">
            <Link href="/rooms" className={pill('primary')}>
              Make a demo booking
            </Link>
            <SampleBookingsButton />
          </div>
        </div>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Metric
              label="Collected"
              value={money(ledger.collected)}
              detail={plural(ledger.counts.collected, 'payment authorized', 'payments authorized')}
              chart={<Meter share={ledger.settledShare} />}
            />
            <Metric
              label="Awaiting payment"
              value={money(ledger.awaiting)}
              detail={unpaid === 0 ? 'Every stay is paid' : plural(unpaid, 'stay not yet paid', 'stays not yet paid')}
            />
            <Metric
              label="Owed back"
              value={money(ledger.owedBack)}
              detail={
                ledger.counts.owed_back === 0
                  ? 'No paid stays cancelled'
                  : plural(ledger.counts.owed_back, 'paid stay cancelled', 'paid stays cancelled')
              }
            />
            <Metric
              label="Booked value"
              value={money(ledger.bookedValue)}
              detail={`${Math.round(ledger.settledShare * 100)}% of it collected`}
            />
          </dl>

          <section aria-labelledby="methods-heading" className="mt-12">
            <h2 id="methods-heading" className="text-display text-2xl sm:text-3xl">
              By payment method
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">Stays that still stand, by how they were booked.</p>
            <div className="mt-5">
              <TableCard caption="Totals by payment method" className="sm:min-w-[36rem]">
                <thead>
                  <tr className="border-b border-border">
                    <Th>Method</Th>
                    <Th className="text-right">Stays</Th>
                    <Th className="text-right">Collected</Th>
                    <Th className="text-right">Awaiting</Th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.byMethod.map((row) => (
                    <tr key={row.method ?? 'none'} className="border-b border-border last:border-b-0">
                      <Td className="font-medium whitespace-nowrap">
                        {row.method ? methodLabel(row.method) : 'No payment recorded'}
                      </Td>
                      <Td className="text-right tabular-nums">{row.stays}</Td>
                      <Td className="text-right tabular-nums whitespace-nowrap">{money(row.collected)}</Td>
                      <Td className="text-right tabular-nums whitespace-nowrap">{money(row.awaiting)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableCard>
            </div>
          </section>

          <section aria-labelledby="ledger-heading" className="mt-12">
            <h2 id="ledger-heading" className="text-display text-2xl sm:text-3xl">
              Payments
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Every demo booking and what became of its payment, newest first.
            </p>
            <div className="mt-5">
              <TableCard caption="Demo bookings and their payment state" className="min-w-[48rem]">
                <thead>
                  <tr className="border-b border-border">
                    <Th>Booked</Th>
                    <Th>Booking number</Th>
                    <Th>Guest</Th>
                    <Th>Method</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.rows.map(({ booking, method, state, amount }) => {
                    const meta = states[state];
                    return (
                      <tr key={booking.id} className="border-b border-border last:border-b-0">
                        <Td className="whitespace-nowrap">{formatDateShort(booking.createdAt.slice(0, 10))}</Td>
                        <Td className="whitespace-nowrap">
                          <Link
                            href={`/admin/bookings/${booking.reference}`}
                            className="font-medium hover:text-accent-strong"
                          >
                            {booking.reference}
                          </Link>
                        </Td>
                        <Td>
                          {booking.guest.firstName} {booking.guest.lastName}
                        </Td>
                        <Td className="whitespace-nowrap">{method ? methodLabel(method) : '—'}</Td>
                        <Td>
                          <span
                            className={cn('inline-flex items-center gap-1.5 font-medium whitespace-nowrap', meta.tone)}
                          >
                            <meta.icon weight="fill" className="size-4 shrink-0" aria-hidden="true" />
                            {meta.label}
                          </span>
                        </Td>
                        <Td className="text-right tabular-nums whitespace-nowrap">
                          {state === 'void' ? '—' : money(amount)}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableCard>
            </div>
          </section>
        </>
      )}
    </AdminPage>
  );
}
