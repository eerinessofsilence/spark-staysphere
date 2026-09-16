'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { CheckCircle, Clock, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { fieldClass, pill } from '@/lib/ui';
import { Switch } from '@/components/ui/switch';
import { SectionLabel } from '@/components/site/section-label';
import { cn } from '@/lib/utils';

interface Accent {
  id: string;
  label: string;
  swatch: string;
  strong: string;
  hover: string;
  soft: string;
}

const accents: Accent[] = [
  { id: 'clay', label: 'Clay', swatch: '#B8603A', strong: '#9A4E2C', hover: '#7F3F23', soft: '#F4E6DD' },
  { id: 'olive', label: 'Olive', swatch: '#6B7A3A', strong: '#4F5B2A', hover: '#3F4922', soft: '#E7EBDA' },
  { id: 'terracotta', label: 'Terracotta', swatch: '#A4503C', strong: '#8A402F', hover: '#733426', soft: '#F2E1DB' },
  { id: 'sand', label: 'Sand', swatch: '#9A7B4F', strong: '#7F6A35', hover: '#66552A', soft: '#EFE7D3' },
  { id: 'ink', label: 'Ink', swatch: '#161616', strong: '#161616', hover: '#2B2B2B', soft: '#E9E5DD' },
];

const languages = [
  { label: 'English', region: 'United Kingdom', live: true },
  { label: 'Русский', region: 'Россия', live: false },
  { label: 'Hrvatski', region: 'Hrvatska', live: false },
  { label: 'Deutsch', region: 'Deutschland', live: false },
  { label: 'Français', region: 'France', live: false },
  { label: 'Italiano', region: 'Italia', live: false },
  { label: 'Español', region: 'España', live: false },
  { label: 'Polski', region: 'Polska', live: false },
];

export interface BrandPreviewRoom {
  roomName: string;
  view: string;
  price: string;
  photoUrl: string;
  photoWidth: number;
  photoHeight: number;
}

interface BrandSettingsProps {
  hotel: { name: string; tagline: string; location: string; currency: string };
  preview: BrandPreviewRoom | null;
}

export function BrandSettings({ hotel, preview }: BrandSettingsProps) {
  const [accentId, setAccentId] = React.useState('clay');
  const [accentButtons, setAccentButtons] = React.useState(false);
  const [saved, setSaved] = React.useState('');
  const [demoHost, setDemoHost] = React.useState('');
  const accent = accents.find((option) => option.id === accentId) ?? accents[0]!;

  React.useEffect(() => setDemoHost(window.location.host), []);

  const previewCard = (
    <PreviewCard hotel={hotel} preview={preview} accent={accent} accentButtons={accentButtons} />
  );

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-sidebar">
      <div className="grid gap-6">
        <Group id="identity" title="Identity" description="Read live from the site content.">
          <dl className="grid gap-4 sm:grid-cols-3">
            <Fact label="Hotel name">{hotel.name}</Fact>
            <Fact label="Tagline">{hotel.tagline}</Fact>
            <Fact label="Location">{hotel.location}</Fact>
          </dl>
          <Link href="/admin/content/hotel" className={pill('secondary', 'mt-5')}>
            Edit in Hotel Settings
          </Link>
        </Group>

        <Group id="logo" title="Logo" description="Shown in the header and footer of the booking site.">
          <div className="flex min-h-24 items-center justify-center rounded-3xl bg-stone/60 px-6">
            <img src="/brand/staysphere-logo-on-light.svg" alt="Current logo" className="h-9 w-auto dark:hidden" />
            <img
              src="/brand/staysphere-logo.svg"
              alt=""
              aria-hidden="true"
              className="hidden h-9 w-auto dark:block"
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" disabled className={pill('secondary')}>
              <ArrowUpTrayIcon className="size-4" aria-hidden="true" />
              Upload logo
            </button>
            <p className="text-sm text-muted-foreground">Uploads arrive with media storage.</p>
          </div>
        </Group>

        <Group
          id="accent"
          title="Accent colour"
          description="Marks active states, focus rings, savings and section labels across the site."
        >
          <div role="radiogroup" aria-labelledby="accent-heading" className="flex flex-wrap gap-2">
            {accents.map((option) => {
              const checked = option.id === accentId;
              return (
                <label
                  key={option.id}
                  className="flex min-w-18 cursor-pointer flex-col items-center gap-1.5 rounded-2xl px-1 py-2 text-xs"
                >
                  <input
                    type="radio"
                    name="accent"
                    value={option.id}
                    checked={checked}
                    onChange={() => setAccentId(option.id)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid size-11 place-items-center rounded-full border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
                      checked ? 'border-foreground' : 'border-transparent',
                    )}
                  >
                    <span
                      className="size-8 rounded-full ring-1 ring-border"
                      style={{ backgroundColor: option.swatch }}
                    />
                  </span>
                  <span className={cn(checked ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                    {option.label}
                  </span>
                  {option.id === 'clay' ? <span className="text-[11px] text-muted-foreground">Current</span> : null}
                </label>
              );
            })}
          </div>
          <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <Switch checked={accentButtons} onCheckedChange={setAccentButtons} className="shrink-0" />
            Use the accent on primary buttons
          </label>
          <div className="mt-4 lg:hidden">{previewCard}</div>
        </Group>

        <Group id="type" title="Typography" description="Set by the design system.">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact label="Interface">
              <span className="block text-base">San Francisco, with Inter elsewhere</span>
              <span className="block text-xs text-muted-foreground">Weights 400–700, every title and label</span>
            </Fact>
            <Fact label="Accent">
              <span className="text-accent-italic block text-xl">One phrase per screen</span>
              <span className="block text-xs text-muted-foreground">Instrument Serif italic</span>
            </Fact>
          </dl>
        </Group>

        <Group id="domain" title="Domain" description="Where guests find the booking site.">
          <dl className="grid gap-4">
            <Row label="Booking site">
              <span className="font-medium">book.asteriacove.com</span>
              <span className="inline-flex items-center gap-1.5 text-warning">
                <WarningCircle weight="fill" className="size-4" aria-hidden="true" />
                DNS not connected
              </span>
            </Row>
            <Row label="This demo">
              <span className="font-medium">{demoHost || '—'}</span>
              <span className="inline-flex items-center gap-1.5 text-success">
                <CheckCircle weight="fill" className="size-4" aria-hidden="true" />
                Serving
              </span>
            </Row>
            <Row label="SSL certificate">
              <span className="text-muted-foreground">Issued automatically once DNS points here</span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Clock weight="fill" className="size-4" aria-hidden="true" />
                Pending
              </span>
            </Row>
          </dl>
          <p className="mt-4 rounded-2xl bg-stone/60 px-4 py-3 text-sm text-muted-foreground">
            To connect: add a CNAME record for <code className="text-foreground">book</code> pointing to{' '}
            <code className="text-foreground">cname.spark-staysphere.example</code>.
          </p>
        </Group>

        <Group id="languages" title="Languages & currency">
          <dl className="grid gap-4">
            <Row label="Currency">
              <span className="font-medium">{hotel.currency}</span>
              <span className="text-muted-foreground">Set by the property</span>
            </Row>
          </dl>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {languages.map((language) => (
              <li
                key={language.label}
                className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-border px-4 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{language.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{language.region}</span>
                </span>
                {language.live ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-success">
                    <CheckCircle weight="fill" className="size-4" aria-hidden="true" />
                    Live
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock weight="fill" className="size-4" aria-hidden="true" />
                    Planned
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Group>

        <Group id="emails" title="Guest emails" description="Confirmation emails are not sent in this demo.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sender-name" className="mb-1.5 block text-sm text-muted-foreground">
                Sender name
              </label>
              <input
                id="sender-name"
                disabled
                defaultValue={hotel.name}
                className={cn(fieldClass, 'disabled:cursor-not-allowed disabled:opacity-60')}
              />
            </div>
            <div>
              <label htmlFor="reply-to" className="mb-1.5 block text-sm text-muted-foreground">
                Reply-to
              </label>
              <input
                id="reply-to"
                disabled
                defaultValue="stay@asteriacove.example"
                className={cn(fieldClass, 'disabled:cursor-not-allowed disabled:opacity-60')}
              />
            </div>
          </div>
        </Group>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
          <button
            type="button"
            onClick={() => setSaved('Demo — nothing was saved.')}
            className={pill('primary')}
          >
            Save changes
          </button>
          <p role="status" aria-live="polite" className="text-sm font-medium text-muted-foreground">
            {saved}
          </p>
        </div>
      </div>

      <aside aria-label="Preview" className="hidden lg:block">
        <div className="sticky top-6">
          <p className="mb-3 text-sm text-muted-foreground">Preview of a room card on the booking site</p>
          {previewCard}
        </div>
      </aside>
    </div>
  );
}

function PreviewCard({
  hotel,
  preview,
  accent,
  accentButtons,
}: {
  hotel: BrandSettingsProps['hotel'];
  preview: BrandPreviewRoom | null;
  accent: Accent;
  accentButtons: boolean;
}) {
  // The guest site's day scheme, whatever scheme this admin is in.
  const scheme = {
    '--accent': accent.swatch,
    '--accent-strong': accent.strong,
    '--accent-soft': accent.soft,
    '--ring': accent.swatch,
    '--primary': accentButtons ? accent.strong : '#161616',
    '--primary-hover': accentButtons ? accent.hover : '#2B2B2B',
    '--primary-foreground': '#F7F5F0',
    '--card': '#FFFFFF',
    '--foreground': '#161616',
    '--muted-foreground': '#6B6B66',
    '--border': '#DDD9D0',
    '--stone': '#E9E5DD',
  } as React.CSSProperties;

  return (
    <div
      data-testid="brand-preview"
      data-accent={accent.id}
      style={scheme}
      className="overflow-hidden rounded-[18px] border border-border bg-card p-3 text-foreground shadow-soft"
    >
      <div className="flex items-center justify-between gap-3 px-2 pt-1 pb-3">
        <span className="truncate text-sm font-semibold">{hotel.name}</span>
        <span className="truncate text-xs text-muted-foreground">{hotel.location}</span>
      </div>
      {preview ? (
        <img
          src={preview.photoUrl}
          alt=""
          width={preview.photoWidth}
          height={preview.photoHeight}
          loading="lazy"
          className="aspect-[4/3] w-full rounded-[14px] object-cover"
        />
      ) : null}
      <div className="px-2 pt-4 pb-2">
        <SectionLabel>Book direct</SectionLabel>
        <p className="text-display mt-2 text-2xl">{preview?.roomName ?? 'Room type'}</p>
        {preview ? <p className="mt-1 text-sm text-muted-foreground">{preview.view}</p> : null}
        {preview ? (
          <p className="text-display mt-3 text-3xl">
            {preview.price}
            <span className="ml-1 font-sans text-sm font-normal tracking-normal text-muted-foreground">/ night</span>
          </p>
        ) : null}
        <p className="mt-1 text-sm font-medium text-accent-strong">Best rate when you book direct</p>
        <span aria-hidden="true" className={pill('primary', 'mt-4 w-full')}>
          Book this room
        </span>
      </div>
    </div>
  );
}

function Group({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="group" aria-labelledby={`${id}-heading`} className="rounded-[18px] bg-card p-6 shadow-soft">
      <h2 id={`${id}-heading`} className="text-lg font-medium">
        {title}
      </h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium break-words">{children}</dd>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">{children}</dd>
    </div>
  );
}
