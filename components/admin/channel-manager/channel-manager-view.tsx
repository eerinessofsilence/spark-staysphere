'use client';

import * as React from 'react';
import Link from 'next/link';
import { CheckCircle } from '@phosphor-icons/react/dist/ssr';
import { MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Field, Select, TextInput } from '@/components/admin/content/fields';
import { fieldClass, pill, tag } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/site/modal';
import { AdminPageHeader } from '@/components/admin/shell/admin-page';
import { toast } from '@/components/admin/shell/toast';
import {
  channels as builtInChannels,
  channexPropertyId,
  CHANNEL_KINDS,
  CONNECTION_METHODS,
  CUSTOM_HUES,
  initiallyConnected,
  type Channel,
  type ConnectionMethod,
} from './channel-data';

/** A short, presentable set of initials from a free-typed channel name — "Nordic Stays" → "NS". */
function monogramFrom(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.slice(0, 2);
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** Appends `-2`, `-3`, … until the id is free of every channel already on the page, built-in or custom. */
function uniqueChannelId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** What "Bookings pulled" says for a channel, by how it actually connects — built-in demo channels have no `connection` and keep the original copy. */
function bookingsPulledLabel(channel: Channel): string {
  switch (channel.connection?.method) {
    case 'one_way':
      return 'Not pulled — availability only';
    case 'feed':
      return 'By email, as they come in';
    default:
      return 'Every 5 minutes';
  }
}

/**
 * The channel manager, the way a hotel team meets it in a PMS: one setup
 * card for the connection itself, then a tile per OTA it sells through.
 * Connecting or disconnecting a channel is local state — nothing leaves the page.
 */
export function ChannelManagerView({ roomTypeCount, rateCount }: { roomTypeCount: number; rateCount: number }) {
  const [customChannels, setCustomChannels] = React.useState<Channel[]>([]);
  const [connected, setConnected] = React.useState<string[]>(initiallyConnected);
  const [adding, setAdding] = React.useState(false);
  const [customOpen, setCustomOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [viewing, setViewing] = React.useState<Channel | null>(null);

  const channels = [...builtInChannels, ...customChannels];
  const connectedChannels = channels.filter((channel) => connected.includes(channel.id));
  const available = channels.filter(
    (channel) =>
      !connected.includes(channel.id) && channel.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const closeAdding = () => {
    setAdding(false);
    setQuery('');
  };

  const connect = (channel: Channel) => {
    setConnected((current) => [...current, channel.id]);
    toast.success(`${channel.name} connected.`);
    closeAdding();
  };

  const addCustom = (channel: Channel) => {
    setCustomChannels((current) => [...current, channel]);
    setConnected((current) => [...current, channel.id]);
    toast.success(`${channel.name} connected.`);
    setCustomOpen(false);
  };

  const disconnect = (channel: Channel) => {
    setConnected((current) => current.filter((id) => id !== channel.id));
    toast.success(`${channel.name} disconnected.`);
    setViewing(null);
  };

  return (
    <>
      <AdminPageHeader
        title="Channel Manager"
        description={`${connectedChannels.length} of ${channels.length} channels connected`}
        actions={
          <>
            <button type="button" onClick={() => setCustomOpen(true)} className={pill('secondary')}>
              <PlusIcon className="size-4" aria-hidden="true" />
              Add custom channel
            </button>
            <button type="button" onClick={() => setAdding(true)} className={pill('primary')}>
              <PlusIcon className="size-4" aria-hidden="true" />
              Add channel
            </button>
          </>
        }
      />

      <section aria-labelledby="channex-heading" className="mt-6 overflow-hidden rounded-[18px] bg-card shadow-soft">
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

      <Modal open={adding} onClose={closeAdding} title="Add channel">
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

      <CustomChannelModal
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onAdd={addCustom}
        existingIds={new Set(channels.map((channel) => channel.id))}
      />

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
              <Fact label="Bookings pulled">{bookingsPulledLabel(viewing)}</Fact>
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

/**
 * A channel not on the known list: no logo, no fixed commission, no set connection —
 * so the form asks for exactly what a real channel manager (Channex, SiteMinder) does
 * to wire one up: what it is, how rates and bookings move, and its own credentials or
 * feed. Demo only — nothing here is validated against a real endpoint or ever reached.
 */
function CustomChannelModal({
  open,
  onClose,
  onAdd,
  existingIds,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (channel: Channel) => void;
  /** Every id already on the page, built-in or custom — so a second channel with the same name gets its own id. */
  existingIds: ReadonlySet<string>;
}) {
  const [name, setName] = React.useState('');
  const [kind, setKind] = React.useState<(typeof CHANNEL_KINDS)[number]>('OTA');
  const [markets, setMarkets] = React.useState('');
  const [commission, setCommission] = React.useState('');
  const [method, setMethod] = React.useState<ConnectionMethod>('two_way');
  const [endpoint, setEndpoint] = React.useState('');
  const [apiKey, setApiKey] = React.useState('');
  const [secret, setSecret] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState('');

  const reset = () => {
    setName('');
    setKind('OTA');
    setMarkets('');
    setCommission('');
    setMethod('two_way');
    setEndpoint('');
    setApiKey('');
    setSecret('');
    setEmail('');
    setError('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const methodMeta = CONNECTION_METHODS.find((option) => option.value === method)!;
  const needsCredentials = method === 'two_way' || method === 'one_way';

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Enter the channel’s name.');
      return;
    }
    if (needsCredentials && !endpoint.trim()) {
      setError('Enter the endpoint this channel connects to.');
      return;
    }
    if (!needsCredentials && !email.trim()) {
      setError('Enter where booking notifications should go.');
      return;
    }
    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'channel';
    const id = uniqueChannelId(`custom-${slug}`, existingIds);
    const hue = CUSTOM_HUES[Math.abs(id.length + trimmedName.length) % CUSTOM_HUES.length]!;
    onAdd({
      id,
      name: trimmedName,
      monogram: monogramFrom(trimmedName),
      hue,
      kind,
      commission: Number(commission) || 0,
      markets: markets.trim() || 'Worldwide',
      connection: needsCredentials
        ? { method, endpoint: endpoint.trim() }
        : { method, email: email.trim() },
    });
    reset();
  };

  return (
    <Modal open={open} onClose={close} title="Add custom channel" className="sm:max-w-xl">
      <form onSubmit={submit} className="grid gap-5">
        <Field id="custom-channel-name" label="Channel name">
          <TextInput
            id="custom-channel-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Nordic Stays"
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="custom-channel-kind" label="Channel type">
            <Select id="custom-channel-kind" value={kind} onChange={(value) => setKind(value as typeof kind)}>
              {CHANNEL_KINDS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="custom-channel-markets" label="Markets" hint="Optional — defaults to Worldwide.">
            <TextInput
              id="custom-channel-markets"
              value={markets}
              onChange={(event) => setMarkets(event.target.value)}
              placeholder="Worldwide"
            />
          </Field>
        </div>

        <Field
          id="custom-channel-commission"
          label="Commission"
          hint="As a percentage of the booking. Leave blank for cost-per-click or a flat fee."
        >
          <TextInput
            id="custom-channel-commission"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.1"
            value={commission}
            onChange={(event) => setCommission(event.target.value)}
            placeholder="15"
            className="sm:w-32"
          />
        </Field>

        <div role="group" aria-labelledby="custom-channel-connection-heading" className="grid gap-2">
          <h3 id="custom-channel-connection-heading" className="text-sm text-muted-foreground">
            How it connects
          </h3>
          <div className="grid gap-2">
            {CONNECTION_METHODS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors',
                  method === option.value ? 'border-foreground bg-stone/60' : 'border-border hover:bg-stone/40',
                )}
              >
                <input
                  type="radio"
                  name="connection-method"
                  value={option.value}
                  checked={method === option.value}
                  onChange={() => setMethod(option.value)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">{option.label}</span>
                  <span className="block text-xs text-muted-foreground">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {needsCredentials ? (
          <div role="group" aria-labelledby="custom-channel-credentials-heading" className="grid gap-4">
            <h3 id="custom-channel-credentials-heading" className="text-sm text-muted-foreground">
              {methodMeta.label} credentials
            </h3>
            <Field id="custom-channel-endpoint" label="API endpoint">
              <TextInput
                id="custom-channel-endpoint"
                type="url"
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
                placeholder="https://"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="custom-channel-key" label="API key / Client ID">
                <TextInput
                  id="custom-channel-key"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="Provided by the channel"
                />
              </Field>
              <Field id="custom-channel-secret" label="Secret">
                <TextInput
                  id="custom-channel-secret"
                  type="password"
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  placeholder="••••••••"
                />
              </Field>
            </div>
          </div>
        ) : (
          <Field
            id="custom-channel-email"
            label="Booking notification email"
            hint="Where a booking made on this channel gets sent, since there is no API to pull it from."
          >
            <TextInput
              id="custom-channel-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="reservations@yourhotel.com"
            />
          </Field>
        )}

        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}

        <p className="rounded-2xl bg-stone/60 px-4 py-3 text-sm text-muted-foreground">
          Demo — nothing here is sent anywhere. Connecting adds the channel to this page only.
        </p>

        <div className="flex flex-wrap gap-3">
          <button type="submit" className={pill('primary')}>
            Add channel
          </button>
          <button type="button" onClick={close} className={pill('secondary')}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
