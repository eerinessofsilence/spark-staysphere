import type { Metadata } from 'next';
import { CheckCircle, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { demoControl } from '@/lib/application/container';
import { formatDate } from '@/lib/formatting';
import { tag } from '@/lib/ui';
import { AdminPage, AdminPageHeader } from '@/components/admin/shell/admin-page';
import { IntegrationConnect } from '@/components/admin/settings/integration-connect';

export const metadata: Metadata = { title: 'Channel Manager — Hotel admin | SPARK StaySphere 360' };
export const dynamic = 'force-dynamic';

const steps = [
  'Rates and restrictions come from one place — this site — and push out to every connected channel.',
  'A booking made on any channel updates availability everywhere else, including this site.',
  'Each channel keeps its own connection below once it is added.',
];

export default async function ChannelManagerPage() {
  const statuses = await demoControl.listIntegrationStatuses();
  const status = statuses.find((candidate) => candidate.adapter === 'channel_manager');

  return (
    <AdminPage>
      <AdminPageHeader
        title="Channel Manager"
        actions={<span className={tag()}>Mock adapter — nothing is connected to a real system</span>}
      />

      <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
        Rates and availability shared with partner channels — OTAs and booking sites the hotel sells
        through besides this one. Channels appear here once they are connected.
      </p>

      <ul className="mt-6 overflow-hidden rounded-[18px] bg-card shadow-soft">
        <li className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6">
          <div className="min-w-0 max-w-2xl">
            <h2 className="font-medium">Channel manager connection</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Rates and availability shared with partner channels.
            </p>
            {status ? (
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
            ) : null}
          </div>
          <IntegrationConnect name="Channel manager" connected={status?.connected ?? false} steps={steps} />
        </li>
      </ul>

      <div className="mt-6 flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-border bg-card p-10 text-center">
        <h2 className="text-display text-2xl">No channels connected yet</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Once a specific channel manager or OTA is chosen, its own connection and sync status will
          show up here, one row per channel.
        </p>
      </div>
    </AdminPage>
  );
}
