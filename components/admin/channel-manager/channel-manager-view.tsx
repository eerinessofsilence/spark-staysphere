'use client';

import * as React from 'react';
import Link from 'next/link';
import { CheckCircle } from '@phosphor-icons/react/dist/ssr';
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import { fieldClass, pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/site/modal';
import { AdminPageHeader } from '@/components/admin/shell/admin-page';
import { channels, channexPropertyId, initiallyConnected, type Channel } from './channel-data';

/**
 * The channel manager, the way a hotel team meets it in a PMS: one setup
 * card for the connection itself, then a tile per OTA it sells through.
 * Connecting or disconnecting a channel is local state — nothing leaves the page.
 */
export function ChannelManagerView({ roomTypeCount, rateCount }: { roomTypeCount: number; rateCount: number }) {
  const [connected, setConnected] = React.useState<string[]>(initiallyConnected);
  const [adding, setAdding] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [viewing, setViewing] = React.useState<Channel | null>(null);
  const [notice, setNotice] = React.useState('');

  const connectedChannels = channels.filter((channel) => connected.includes(channel.id));
  const available = channels.filter(
    (channel) =>
      !connected.includes(channel.id) && channel.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const connect = (channel: Channel) => {
    setConnected((current) => [...current, channel.id]);
    setNotice(`${channel.name} connected — demo only, nothing was sent to ${channel.name}.`);
    setAdding(false);
    setQuery('');
  };

  const disconnect = (channel: Channel) => {
    setConnected((current) => current.filter((id) => id !== channel.id));
    setNotice(`${channel.name} disconnected — demo only.`);
    setViewing(null);
  };

  return (
    <>
      <AdminPageHeader
        title="Channel Manager"
        description={`${connectedChannels.length} of ${channels.length} channels connected`}
        actions={
          <button type="button" onClick={() => setAdding(true)} className={pill('primary')}>
            <PlusIcon className="size-4" aria-hidden="true" />
            Add channel
          </button>
        }
      />

      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-success">
        {notice}
      </p>

      <section aria-labelledby="channex-heading" className="mt-3 overflow-hidden rounded-[18px] bg-card shadow-soft">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4 sm:px-6">
          <h2 id="channex-heading" className="font-medium">
            Channex connection
          </h2>
          <span className={tag('bg-success/10 text-success')}>Live (mock)</span>
        </div>
        <ol className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
          <Step title="Property ID" action={<span className="text-xs text-muted-foreground">Synced every 5 minutes</span>}>
            <span className="font-mono text-xs break-all">{channexPropertyId}</span>
          </Step>
          <Step
            title="Room types"
            action={
              <Link href="/admin/content" className="text-sm font-medium hover:text-accent-strong">
                Manage
              </Link>
            }
          >
            {roomTypeCount} room types mapped, each with its own availability.
          </Step>
          <Step
            title="Room rates"
            action={
              <Link href="/admin/rates" className="text-sm font-medium hover:text-accent-strong">
                Manage
              </Link>
            }
          >
            {rateCount} rate plans and their meal conditions sent to every channel.
          </Step>
          <Step
            title="Restrictions"
            action={
              <Link href="/admin/rates" className={pill('secondary', 'min-h-9 px-4')}>
                Set restrictions
              </Link>
            }
          >
            Stop-sells and last-room overrides apply on every channel at once.
          </Step>
        </ol>
      </section>

      <section aria-labelledby="channels-heading" className="mt-8">
        <h2 id="channels-heading" className="font-medium">
          Connected channels
        </h2>
        {connectedChannels.length === 0 ? (
          <div className="mt-3 flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">No channels connected. Add one to start selling through it.</p>
            <button type="button" onClick={() => setAdding(true)} className={pill('primary')}>
              <PlusIcon className="size-4" aria-hidden="true" />
              Add channel
            </button>
          </div>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {connectedChannels.map((channel) => (
              <li key={channel.id} className="flex flex-col overflow-hidden rounded-[18px] bg-card shadow-soft">
                <div className="flex flex-1 flex-col items-center gap-3 px-4 py-6 text-center">
                  <Monogram channel={channel} size="lg" />
                  <div className="min-w-0">
                    <p className="font-medium">{channel.name}</p>
                    <p className="mt-0.5 flex items-center justify-center gap-1.5 text-xs text-success">
                      <CheckCircle weight="fill" className="size-3.5" aria-hidden="true" />
                      Connected
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewing(channel)}
                  className="cursor-pointer border-t border-border py-3 text-sm font-medium transition-colors hover:bg-stone"
                >
                  View info
                  <span className="sr-only"> for {channel.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={adding}
        onClose={() => {
          setAdding(false);
          setQuery('');
        }}
        title="Add channel"
      >
        <div className="relative">
          <MagnifyingGlassIcon
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search channels"
            aria-label="Search channels"
            className={cn(fieldClass, 'pl-10')}
          />
        </div>
        <ul className="mt-4 grid gap-1">
          {available.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              {query ? 'No channels match.' : 'Every channel is already connected.'}
            </li>
          ) : (
            available.map((channel) => (
              <li key={channel.id} className="flex items-center gap-3 rounded-2xl px-2 py-2">
                <Monogram channel={channel} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{channel.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {channel.kind} · {channel.markets}
                  </span>
                </span>
                <button type="button" onClick={() => connect(channel)} className={pill('secondary', 'min-h-9 px-4')}>
                  Connect
                  <span className="sr-only"> {channel.name}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </Modal>

      <Modal open={viewing !== null} onClose={() => setViewing(null)} title={viewing?.name ?? 'Channel'}>
        {viewing ? (
          <div>
            <div className="flex items-center gap-3">
              <Monogram channel={viewing} />
              <div>
                <p className="font-medium">{viewing.name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-success">
                  <CheckCircle weight="fill" className="size-3.5" aria-hidden="true" />
                  Connected · last sync 4 minutes ago
                </p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <Fact label="Channel type">{viewing.kind}</Fact>
              <Fact label="Markets">{viewing.markets}</Fact>
              <Fact label="Commission">{viewing.commission === 0 ? 'Cost per click' : `${viewing.commission}%`}</Fact>
              <Fact label="Room types mapped">
                {roomTypeCount} of {roomTypeCount}
              </Fact>
              <Fact label="Rate plans mapped">
                {rateCount} of {rateCount}
              </Fact>
              <Fact label="Bookings pulled">Every 5 minutes</Fact>
            </dl>
            <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => disconnect(viewing)}
                className={pill('ghost', 'text-danger hover:bg-danger/10')}
              >
                Disconnect
              </button>
              <button type="button" onClick={() => setViewing(null)} className={pill('primary', 'ml-auto')}>
                Done
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function Step({ title, action, children }: { title: string; action: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-2 bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium">{title}</h3>
        <CheckCircle weight="fill" className="size-6 shrink-0 text-success" aria-label="Done" />
      </div>
      <p className="flex-1 text-sm text-muted-foreground">{children}</p>
      <div className="mt-2">{action}</div>
    </li>
  );
}

function Monogram({ channel, size = 'md' }: { channel: Channel; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: channel.hue.bg, color: channel.hue.ink }}
      className={cn(
        'grid shrink-0 place-items-center rounded-2xl font-bold',
        size === 'lg' ? 'size-16 text-xl' : size === 'md' ? 'size-12 text-base' : 'size-10 text-sm',
      )}
    >
      {channel.monogram}
    </span>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}
