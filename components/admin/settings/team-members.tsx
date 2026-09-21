'use client';

import * as React from 'react';
import Link from 'next/link';
import { PlusIcon } from '@heroicons/react/24/outline';
import { CheckCircle, EnvelopeSimple } from '@phosphor-icons/react/dist/ssr';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { pluralForm } from '@/lib/i18n/plural';
import { Modal } from '@/components/site/modal';
import { fieldClass, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TeamRoleDefinition } from '@/lib/domain/schemas';
import { AdminPageHeader } from '@/components/admin/shell/admin-page';
import { ClientPagination, paginateClient } from '@/components/admin/operations/client-pagination';
import { TeamTabs } from './team-tabs';
import { initialsOf, roleLabel, type TeamMember, type TeamRole } from './team-data';

export function TeamMembers({ initialMembers, roles }: { initialMembers: TeamMember[]; roles: TeamRoleDefinition[] }) {
  const t = useAdminT();
  const locale = useAdminLocale();
  const [members, setMembers] = React.useState<TeamMember[]>(initialMembers);
  const [page, setPage] = React.useState(1);
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<TeamRole>('Front desk');
  const [error, setError] = React.useState<'invalid' | 'duplicate' | ''>('');
  const [status, setStatus] = React.useState('');
  const close = React.useCallback(() => setOpen(false), []);

  const count = members.length;
  const canSignIn = pluralForm(locale, count, {
    one: t('team.signInOne', { count }),
    few: t('team.signInFew', { count }),
    many: t('team.signInMany', { count }),
    other: t('team.signInOther', { count }),
  });

  const invite = (event: React.FormEvent) => {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('invalid');
      return;
    }
    if (members.some((member) => member.email === address)) {
      setError('duplicate');
      return;
    }
    setMembers((current) => [
      ...current,
      {
        id: `invite-${address}`,
        name: address.split('@')[0]!.replace(/[._-]+/g, ' '),
        email: address,
        role,
        status: 'invited',
        lastActive: 'team.notSignedIn',
        demoInvite: true,
      },
    ]);
    setStatus(t('team.added', { email: address, role: roleLabel(role, roles, t) }));
    setEmail('');
    setError('');
    setOpen(false);
  };

  const { pageItems, page: currentPage, totalPages } = paginateClient(members, page);

  return (
    <>
      <AdminPageHeader
        title={t('team.members')}
        actions={
          <button type="button" onClick={() => setOpen(true)} className={pill('primary')}>
            <PlusIcon className="size-4" aria-hidden="true" />
            {t('team.invite')}
          </button>
        }
      />
      <TeamTabs current="members" counts={{ members: members.length, roles: roles.length }} />

      <section aria-label={t('team.members')} className="mt-8">
        <p className="text-sm text-muted-foreground">{canSignIn}</p>

      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm font-medium text-success">
        {status}
      </p>

      <div className="relative mt-2 overflow-hidden rounded-[18px] bg-card shadow-soft">
        <div className="overflow-x-auto contain-inline-size">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <caption className="sr-only">{t('team.tableCaption')}</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <Th>{t('team.thMember')}</Th>
              <Th>{t('team.thRole')}</Th>
              <Th>{t('team.thStatus')}</Th>
              <Th>{t('team.thLastActive')}</Th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((member) => {
              // A demo invite lives only in this component's state — there is
              // nothing at its own URL to open, so unlike a seeded member its
              // row stays plain text rather than promising a page that 404s.
              const linkable = !member.demoInvite;
              const identity = (
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-stone text-xs font-semibold"
                  >
                    {initialsOf(member.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium capitalize">{member.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{member.email}</span>
                  </span>
                </div>
              );
              return (
              <tr key={member.id} className={cn('relative border-b border-border last:border-b-0', linkable && 'transition-colors hover:bg-stone/50')}>
                <td className="px-4 py-3">
                  {linkable ? (
                    <Link
                      href={`/admin/settings/team/${encodeURIComponent(member.id)}`}
                      aria-label={t('team.editMember', { name: member.name })}
                      className="before:absolute before:inset-0"
                    >
                      {identity}
                    </Link>
                  ) : (
                    identity
                  )}
                </td>
                <td className="px-4 py-3">{roleLabel(member.role, roles, t)}</td>
                <td className="px-4 py-3">
                  {member.status === 'active' ? (
                    <span className="inline-flex items-center gap-1.5 text-success">
                      <CheckCircle weight="fill" className="size-4" aria-hidden="true" />
                      {t('team.active')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-warning">
                      <EnvelopeSimple weight="fill" className="size-4" aria-hidden="true" />
                      {member.demoInvite ? t('team.invitedDemo') : t('team.invited')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{t(member.lastActive)}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        <ClientPagination page={currentPage} totalPages={totalPages} total={members.length} onPageChange={setPage} attached />
      </div>

      <Modal open={open} onClose={close} title={t('team.invite')}>
        <form onSubmit={invite} noValidate className="grid gap-4">
          <p className="text-sm text-muted-foreground">{t('team.inviteBody')}</p>
          <div>
            <label htmlFor="invite-email" className="mb-1.5 block text-sm text-muted-foreground">
              {t('team.email')}
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@asteriacove.example"
              className={fieldClass}
              autoComplete="off"
            />
            {error ? (
              <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
                {error === 'invalid' ? t('team.emailInvalid') : t('team.alreadyOnTeam')}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="invite-role" className="mb-1.5 block text-sm text-muted-foreground">
              {t('team.role')}
            </label>
            <Select
              items={roles.map((option) => ({ value: option.id, label: roleLabel(option.id, roles, t) }))}
              value={role}
              onValueChange={(next) => setRole(next ?? roles[0]?.id ?? 'Front desk')}
            >
              <SelectTrigger id="invite-role" className={cn(fieldClass, 'justify-between gap-2 py-0')}>
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
          <div className="flex flex-wrap gap-3">
            <button type="submit" className={pill('primary')}>
              {t('team.addToTeam')}
            </button>
            <button type="button" onClick={close} className={pill('secondary')}>
              {t('team.cancel')}
            </button>
          </div>
        </form>
      </Modal>
      </section>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-4 py-3 text-sm font-normal text-muted-foreground">
      {children}
    </th>
  );
}
