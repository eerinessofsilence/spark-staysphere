'use client';

import * as React from 'react';
import Link from 'next/link';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import type { TeamRoleDefinition } from '@/lib/domain/schemas';
import { useAdminT } from '@/lib/i18n/admin/context';
import { fieldClass, pill } from '@/lib/ui';
import { initialsOf, roleLabel, type TeamMember } from './team-data';

/**
 * `/admin/account` — same shape as `BrandSettings`: local state only, a
 * "Save changes" button that never leaves the browser, no server action.
 * `member` is whoever signed in (`admin-session.ts`), the person the
 * sidebar's `AccountMenu` names — this page is what its "Account" opens.
 */
export function AccountSettings({
  member: me,
  roles,
  canManageRoles,
}: {
  member: TeamMember;
  roles: TeamRoleDefinition[];
  canManageRoles: boolean;
}) {
  const [meFirstName, meLastName] = me.name.split(' ');
  const [firstName, setFirstName] = React.useState(meFirstName ?? '');
  const [lastName, setLastName] = React.useState(meLastName ?? '');
  const [email, setEmail] = React.useState(me.email);
  const [phone, setPhone] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<'tooShort' | 'mismatch' | ''>('');
  const [saved, setSaved] = React.useState(false);
  const t = useAdminT();

  const initials = initialsOf(`${firstName} ${lastName}`.trim() || me.name);

  const save = () => {
    if (password && password.length < 8) {
      setError('tooShort');
      setSaved(false);
      return;
    }
    if (password !== confirmPassword) {
      setError('mismatch');
      setSaved(false);
      return;
    }
    setError('');
    setPassword('');
    setConfirmPassword('');
    setSaved(true);
  };

  return (
    <div className="grid gap-6">
      <Group id="profile" title={t('account.profile')} description={t('account.profileBody')}>
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="grid size-16 shrink-0 place-items-center rounded-full bg-stone text-lg font-semibold"
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="text-display truncate text-2xl">{`${firstName} ${lastName}`.trim() || t('account.unnamed')}</p>
            <p className="text-sm text-muted-foreground">{t('account.demo', { role: roleLabel(me.role, roles, t) })}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="account-firstName" className="mb-1.5 block text-sm text-muted-foreground">
              {t('account.firstName')}
            </label>
            <input
              id="account-firstName"
              value={firstName}
              onChange={(event) => {
                setFirstName(event.target.value);
                setSaved(false);
              }}
              className={fieldClass}
              autoComplete="given-name"
            />
          </div>
          <div>
            <label htmlFor="account-lastName" className="mb-1.5 block text-sm text-muted-foreground">
              {t('account.lastName')}
            </label>
            <input
              id="account-lastName"
              value={lastName}
              onChange={(event) => {
                setLastName(event.target.value);
                setSaved(false);
              }}
              className={fieldClass}
              autoComplete="family-name"
            />
          </div>
        </div>
      </Group>

      <Group id="contact" title={t('account.contact')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="account-email" className="mb-1.5 block text-sm text-muted-foreground">
              {t('account.email')}
            </label>
            <input
              id="account-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setSaved(false);
              }}
              className={fieldClass}
              autoComplete="email"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">{t('account.emailHint')}</p>
          </div>
          <div>
            <label htmlFor="account-phone" className="mb-1.5 block text-sm text-muted-foreground">
              {t('account.phone')}
            </label>
            <input
              id="account-phone"
              type="tel"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setSaved(false);
              }}
              placeholder={t('account.notSet')}
              className={fieldClass}
              autoComplete="tel"
            />
          </div>
        </div>
      </Group>

      <Group id="role" title={t('account.role')} description={t('account.roleBody')}>
        <Row label={t('account.role')}>
          <span className="font-medium">{roleLabel(me.role, roles, t)}</span>
          {canManageRoles ? (
            <Link href={`/admin/settings/team/${encodeURIComponent(me.id)}`} className={pill('ghost', 'min-h-8 px-3')}>
              <PencilSquareIcon className="size-4" aria-hidden="true" />
              {t('account.changeRole')}
            </Link>
          ) : null}
        </Row>
        <Row label={t('account.team')}>
          <Link href="/admin/settings/team" className="font-medium hover:text-accent-strong">
            {t('account.teamRoles')}
          </Link>
        </Row>
      </Group>

      <Group id="password" title={t('account.password')} description={t('account.passwordBody')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="account-password" className="mb-1.5 block text-sm text-muted-foreground">
              {t('account.newPassword')}
            </label>
            <input
              id="account-password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError('');
                setSaved(false);
              }}
              placeholder="••••••••"
              className={fieldClass}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label htmlFor="account-confirmPassword" className="mb-1.5 block text-sm text-muted-foreground">
              {t('account.confirmPassword')}
            </label>
            <input
              id="account-confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setError('');
                setSaved(false);
              }}
              placeholder="••••••••"
              className={fieldClass}
              autoComplete="new-password"
            />
          </div>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {error === 'tooShort' ? t('account.passwordTooShort') : t('account.passwordMismatch')}
          </p>
        ) : null}
      </Group>

      {/* The page reserves space after all settings for this fixed action dock. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 lg:pl-[calc(17.5rem+1.5rem)]">
        <div className="glass-bar pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-full p-1.5">
          <button type="button" onClick={save} className={pill('primary')}>
            {t('account.save')}
          </button>
          <p role="status" aria-live="polite" className="px-2 text-sm font-medium text-muted-foreground">
            {saved ? t('account.demoNothingSaved') : ''}
          </p>
        </div>
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
