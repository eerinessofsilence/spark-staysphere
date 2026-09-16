import type { Metadata } from 'next';
import { CheckCircle, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { demoControl } from '@/lib/application/container';
import type { IntegrationStatus } from '@/lib/domain/schemas';
import { formatDate } from '@/lib/formatting';
import { tag } from '@/lib/ui';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { IntegrationConnect } from '@/components/admin/settings/integration-connect';

export const metadata: Metadata = { title: 'Integrations — Hotel admin | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

const details: Record<IntegrationStatus['adapter'], { name: string; syncs: string; steps: string[] }> = {
  pms: {
    name: 'Property management system',
    syncs: 'Rooms, inventory and reservations — the source of truth in production.',
    steps: [
      'Room types and physical rooms are read from the PMS.',
      'Every direct booking is written back as a reservation.',
      'Availability on this site follows the PMS, not the demo simulation.',
    ],
  },
  channel_manager: {
    name: 'Channel manager',
    syncs: 'Rates and availability shared with partner channels.',
    steps: [
      'Rates and restrictions come from one place for every channel.',
      'A booking here updates availability everywhere else.',
    ],
  },
  booking_engine: {
    name: 'Booking engine',
    syncs: 'Quotes and holds for the direct booking flow.',
    steps: ['Prices and holds are confirmed by the engine before a booking is created.'],
  },
  payment: {
    name: 'Payment provider',
    syncs: 'Tokenised payment collection — no card data touches this site.',
    steps: [
      'Card details are collected in the provider’s own hosted fields.',
      'Authorisations and refunds are recorded against each booking.',
    ],
  },
  crm: {
    name: 'CRM',
    syncs: 'Guest profiles and stay history.',
    steps: ['Guests and their stays are sent to the CRM after each booking.'],
  },
};

export default async function IntegrationsPage() {
  const statuses = await demoControl.listIntegrationStatuses();

  return (
    <AdminPage>
      <AdminPageHeader
        title="Integrations"
        actions={<span className={tag()}>Mock adapters — nothing is connected to a real system</span>}
      />

      <ul className="mt-10 overflow-hidden rounded-[18px] bg-card shadow-soft">
        {statuses.map((status) => {
          const detail = details[status.adapter];
          return (
            <li
              key={status.adapter}
              className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-5 last:border-b-0 sm:px-6"
            >
              <div className="min-w-0 max-w-2xl">
                <h2 className="font-medium">{detail.name}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{detail.syncs}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className={tag('capitalize')}>{status.mode}</span>
                  {status.connected ? (
                    <span className="inline-flex items-center gap-1.5 text-success">
                      <CheckCircle weight="fill" className="size-4" aria-hidden="true" />
                      Connected (mock)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-warning">
                      <WarningCircle weight="fill" className="size-4" aria-hidden="true" />
                      Not connected
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    Last sync {status.lastSyncAt ? formatDate(status.lastSyncAt.slice(0, 10)) : 'never'}
                  </span>
                </p>
              </div>
              <IntegrationConnect name={detail.name} connected={status.connected} steps={detail.steps} />
            </li>
          );
        })}
      </ul>
    </AdminPage>
  );
}
