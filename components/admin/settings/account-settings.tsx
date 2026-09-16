'use client';

import * as React from 'react';
import Link from 'next/link';
import { fieldClass, pill } from '@/lib/ui';
import { demoMembers, initialsOf } from './team-data';

const me = demoMembers[0]!;
const [meFirstName, meLastName] = me.name.split(' ');

/**
 * `/admin/account` — same shape as `BrandSettings`: local state only, a
 * "Save changes" button that never leaves the browser, no server action.
 * `me` is `demoMembers[0]` (Elena, Owner), the person `DemoAccount` in the
 * sidebar names — this page is what clicking that block opens.
 */
export function AccountSettings() {
  const [firstName, setFirstName] = React.useState(meFirstName ?? '');
  const [lastName, setLastName] = React.useState(meLastName ?? '');
  const [email, setEmail] = React.useState(me.email);
  const [phone, setPhone] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [saved, setSaved] = React.useState('');

  const initials = initialsOf(`${firstName} ${lastName}`.trim() || me.name);

  const save = () => {
    if (password && password.length < 8) {
      setError('New password must be at least 8 characters.');
      setSaved('');
      return;
    }
    if (password !== confirmPassword) {
      setError("New password and confirmation don't match.");
      setSaved('');
      return;
    }
    setError('');
    setPassword('');
    setConfirmPassword('');
    setSaved('Demo — nothing was saved.');
  };

  return (
    <div className="grid gap-6">
      <Group id="profile" title="Profile" description="How your name appears across this admin.">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="grid size-16 shrink-0 place-items-center rounded-full bg-stone text-lg font-semibold"
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="text-display truncate text-2xl">{`${firstName} ${lastName}`.trim() || 'Unnamed'}</p>
            <p className="text-sm text-muted-foreground">{me.role} · demo account</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="account-firstName" className="mb-1.5 block text-sm text-muted-foreground">
              First name
            </label>
            <input
              id="account-firstName"
              value={firstName}
              onChange={(event) => {
                setFirstName(event.target.value);
                setSaved('');
              }}
              className={fieldClass}
              autoComplete="given-name"
            />
          </div>
          <div>
            <label htmlFor="account-lastName" className="mb-1.5 block text-sm text-muted-foreground">
              Last name
            </label>
            <input
              id="account-lastName"
              value={lastName}
              onChange={(event) => {
                setLastName(event.target.value);
                setSaved('');
              }}
              className={fieldClass}
              autoComplete="family-name"
            />
          </div>
        </div>
      </Group>

      <Group id="contact" title="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="account-email" className="mb-1.5 block text-sm text-muted-foreground">
              Email
            </label>
            <input
              id="account-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setSaved('');
              }}
              className={fieldClass}
              autoComplete="email"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">What you&apos;d sign in with, once /admin has sign-in.</p>
          </div>
          <div>
            <label htmlFor="account-phone" className="mb-1.5 block text-sm text-muted-foreground">
              Phone
            </label>
            <input
              id="account-phone"
              type="tel"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setSaved('');
              }}
              placeholder="Not set"
              className={fieldClass}
              autoComplete="tel"
            />
          </div>
        </div>
      </Group>

      <Group id="role" title="Role" description="Set by whoever manages the team.">
        <Row label="Role">
          <span className="font-medium">{me.role}</span>
        </Row>
        <Row label="Team">
          <Link href="/admin/settings/team" className="font-medium hover:text-accent-strong">
            Team & roles
          </Link>
        </Row>
      </Group>

      <Group id="password" title="Password" description="Demo — sign-in arrives with admin auth.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="account-password" className="mb-1.5 block text-sm text-muted-foreground">
              New password
            </label>
            <input
              id="account-password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError('');
                setSaved('');
              }}
              placeholder="••••••••"
              className={fieldClass}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label htmlFor="account-confirmPassword" className="mb-1.5 block text-sm text-muted-foreground">
              Confirm new password
            </label>
            <input
              id="account-confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setError('');
                setSaved('');
              }}
              placeholder="••••••••"
              className={fieldClass}
              autoComplete="new-password"
            />
          </div>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
      </Group>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <button type="button" onClick={save} className={pill('primary')}>
          Save changes
        </button>
        <p role="status" aria-live="polite" className="text-sm font-medium text-muted-foreground">
          {saved}
        </p>
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-3 last:border-b-0 last:pb-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">{children}</dd>
    </div>
  );
}
