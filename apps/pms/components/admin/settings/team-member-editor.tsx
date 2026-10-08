'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { CheckCircle, EnvelopeSimple } from '@phosphor-icons/react/dist/ssr';
import { setMemberHotelsAction, setMemberRoleAction } from '@/app/admin/settings/team/actions';
import type { TeamRoleDefinition } from '@/lib/domain/schemas';
import { useAdminT } from '@/lib/i18n/admin/context';
import { fieldClass, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { initialsOf, roleLabel, type TeamMember, type TeamRole } from './team-data';

/**
 * A team member's own page, opened from their row on `/admin/settings/team`
 * — same shape as `AccountSettings` (local state, a "Save" that never
 * leaves the browser) for the profile fields, since there is still nowhere
 * for those to persist to. The role picker is the one field that is real:
 * it round-trips through `setMemberRoleAction`, which is what
 * `requirePermission` reads back the next time this member does anything —
 * so it gets its own "Save role" and its own outcome, not folded into the
 * profile's demo-only note.
 */
export function TeamMemberEditor({ member, roles, hotels }: { member: TeamMember; roles: TeamRoleDefinition[]; hotels: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const t = useAdminT();
  const [memberFirstName, memberLastName] = member.name.split(' ');
  const [firstName, setFirstName] = React.useState(memberFirstName ?? '');
  const [lastName, setLastName] = React.useState(memberLastName ?? '');
  const [email, setEmail] = React.useState(member.email);
  const [saved, setSaved] = React.useState(false);

  const [role, setRole] = React.useState<TeamRole>(member.role);
  const [savingRole, setSavingRole] = React.useState(false);
  const [roleMessage, setRoleMessage] = React.useState('');
  const [roleError, setRoleError] = React.useState(false);
  const [hotelIds, setHotelIds] = React.useState<string[]>(member.hotelIds ?? []);
  const [savingHotels, setSavingHotels] = React.useState(false);
  const [hotelMessage, setHotelMessage] = React.useState('');

  const initials = initialsOf(`${firstName} ${lastName}`.trim() || member.name);
  const dirty = (setter: React.Dispatch<React.SetStateAction<string>>) => (value: string) => {
    setter(value);
    setSaved(false);
  };

  async function saveRole() {
    setSavingRole(true);
    setRoleMessage('');
    const result = await setMemberRoleAction(member.id, role);
    setSavingRole(false);
    setRoleError(!result.ok);
    setRoleMessage(result.message);
    if (result.ok) router.refresh();
  }

  async function saveHotels() {
    setSavingHotels(true);
    setHotelMessage('');
    const result = await setMemberHotelsAction(member.id, hotelIds);
    setSavingHotels(false);
    setHotelMessage(result.message);
    if (result.ok) router.refresh();
  }

  return (
    <div className="grid gap-6">
      <Group title={t('account.profile')} description={t('team.memberProfileBody')}>
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="grid size-16 shrink-0 place-items-center rounded-full bg-stone text-lg font-semibold"
          >
            {initials}
          </span>
          <div className="min-w-0">
            <p className="text-display truncate text-2xl">{`${firstName} ${lastName}`.trim() || t('account.unnamed')}</p>
            {member.status === 'active' ? (
              <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-success">
                <CheckCircle weight="fill" className="size-4" aria-hidden="true" />
                {t('team.active')}
              </p>
            ) : (
              <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-warning">
                <EnvelopeSimple weight="fill" className="size-4" aria-hidden="true" />
                {member.demoInvite ? t('team.invitedDemo') : t('team.invited')}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="member-firstName" className="mb-1.5 block text-sm text-muted-foreground">
              {t('account.firstName')}
            </label>
            <input
              id="member-firstName"
              value={firstName}
              onChange={(event) => dirty(setFirstName)(event.target.value)}
              className={fieldClass}
              autoComplete="given-name"
            />
          </div>
          <div>
            <label htmlFor="member-lastName" className="mb-1.5 block text-sm text-muted-foreground">
              {t('account.lastName')}
            </label>
            <input
              id="member-lastName"
              value={lastName}
              onChange={(event) => dirty(setLastName)(event.target.value)}
              className={fieldClass}
              autoComplete="family-name"
            />
          </div>
        </div>
      </Group>
      {role === 'Hotelier' ? <Group title="Доступ к отелям" description="Hotelier увидит только отчёты и уведомления назначенных отелей.">
        {hotels.map((hotel) => <label key={hotel.id} className="flex min-h-10 items-center gap-3 text-sm">
          <input type="checkbox" checked={hotelIds.includes(hotel.id)} onChange={(event) => setHotelIds((current) => event.target.checked ? [...current, hotel.id] : current.filter((id) => id !== hotel.id))} />
          {hotel.name}
        </label>)}
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <button type="button" onClick={saveHotels} disabled={savingHotels || JSON.stringify(hotelIds) === JSON.stringify(member.hotelIds ?? [])} className={pill('primary')}>{savingHotels ? 'Сохраняем…' : 'Сохранить отели'}</button>
          <p role="status" className="text-sm text-muted-foreground">{hotelMessage}</p>
        </div>
      </Group> : null}

      <Group title={t('account.contact')}>
        <div>
          <label htmlFor="member-email" className="mb-1.5 block text-sm text-muted-foreground">
            {t('account.email')}
          </label>
          <input
            id="member-email"
            type="email"
            value={email}
            onChange={(event) => dirty(setEmail)(event.target.value)}
            className={fieldClass}
            autoComplete="email"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">{t('team.memberEmailHint')}</p>
        </div>
      </Group>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <button type="button" onClick={() => setSaved(true)} className={pill('primary')}>
          {t('account.save')}
        </button>
        <p role="status" aria-live="polite" className="text-sm font-medium text-muted-foreground">
          {saved ? t('account.demoNothingSaved') : ''}
        </p>
      </div>

      <Group title={t('team.membership')} description={t('team.membershipBody')}>
        <div>
          <label htmlFor="member-role" className="mb-1.5 block text-sm text-muted-foreground">
            {t('team.role')}
          </label>
          <Select
            items={roles.map((option) => ({ value: option.id, label: roleLabel(option.id, roles, t) }))}
            value={role}
            onValueChange={(next) => {
              setRole(next ?? roles[0]?.id ?? member.role);
              setRoleMessage('');
            }}
          >
            <SelectTrigger id="member-role" className={cn(fieldClass, 'justify-between gap-2 py-0')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border border-border bg-card p-1.5 shadow-soft ring-0">
              {roles.map((option) => (
                <SelectItem
                  key={option.id}
                  value={option.id}
                  className="rounded-xl py-2 pl-2.5 text-sm data-highlighted:bg-stone data-highlighted:text-foreground"
                >
                  {roleLabel(option.id, roles, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Row label={t('team.thLastActive')}>
          <span className="font-medium">{t(member.lastActive)}</span>
        </Row>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={saveRole}
            disabled={savingRole || role === member.role}
            className={pill('primary')}
          >
            {savingRole ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t('team.saveRole')}
          </button>
          <p role="status" aria-live="polite" className={cn('text-sm font-medium', roleError ? 'text-danger' : 'text-success')}>
            {roleMessage}
          </p>
        </div>
      </Group>
    </div>
  );
}

function Group({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[18px] bg-card p-6 shadow-soft">
      <h2 className="text-lg font-medium">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      <div className="mt-5 grid gap-4">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border pt-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
