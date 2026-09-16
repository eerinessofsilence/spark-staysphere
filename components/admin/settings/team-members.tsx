'use client';

import * as React from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { CheckCircle, EnvelopeSimple } from '@phosphor-icons/react/dist/ssr';
import { Modal } from '@/components/site/modal';
import { fieldClass, pill } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { demoMembers, initialsOf, teamRoles, type TeamMember, type TeamRole } from './team-data';

export function TeamMembers() {
  const [members, setMembers] = React.useState<TeamMember[]>(demoMembers);
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<TeamRole>('Front desk');
  const [error, setError] = React.useState('');
  const [status, setStatus] = React.useState('');
  const close = React.useCallback(() => setOpen(false), []);

  const invite = (event: React.FormEvent) => {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('Enter an email address, e.g. name@asteriacove.example.');
      return;
    }
    if (members.some((member) => member.email === address)) {
      setError('That person is already on the team.');
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
        lastActive: 'Not signed in yet',
        demoInvite: true,
      },
    ]);
    setStatus(`${address} added as ${role}. No email was sent — this is a demo.`);
    setEmail('');
    setError('');
    setOpen(false);
  };

  return (
    <section aria-labelledby="members-heading">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="members-heading" className="text-display text-3xl">
            Members
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {members.length} people can sign in to this admin.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className={pill('primary')}>
          <PlusIcon className="size-4" aria-hidden="true" />
          Invite teammate
        </button>
      </div>

      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm font-medium text-success">
        {status}
      </p>

      <div className="relative mt-2 overflow-x-auto rounded-[18px] bg-card shadow-soft contain-inline-size">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <caption className="sr-only">Team members and their roles</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <Th>Member</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Last active</Th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3">
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
                </td>
                <td className="px-4 py-3">{member.role}</td>
                <td className="px-4 py-3">
                  {member.status === 'active' ? (
                    <span className="inline-flex items-center gap-1.5 text-success">
                      <CheckCircle weight="fill" className="size-4" aria-hidden="true" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-warning">
                      <EnvelopeSimple weight="fill" className="size-4" aria-hidden="true" />
                      {member.demoInvite ? 'Invited (demo)' : 'Invited'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{member.lastActive}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={close} title="Invite teammate">
        <form onSubmit={invite} noValidate className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            In production this sends a sign-in link. In this demo the person is only added to the
            list in this browser.
          </p>
          <div>
            <label htmlFor="invite-email" className="mb-1.5 block text-sm text-muted-foreground">
              Email
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
                {error}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="invite-role" className="mb-1.5 block text-sm text-muted-foreground">
              Role
            </label>
            <Select
              items={teamRoles.map((option) => ({ value: option, label: option }))}
              value={role}
              onValueChange={(next) => setRole((next ?? teamRoles[0]) as TeamRole)}
            >
              <SelectTrigger id="invite-role" className={cn(fieldClass, 'justify-between gap-2 py-0')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border border-border bg-card p-1.5 shadow-soft ring-0">
                {teamRoles.map((option) => (
                  <SelectItem
                    key={option}
                    value={option}
                    className="rounded-xl py-2 pl-2.5 text-sm data-highlighted:bg-stone data-highlighted:text-foreground"
                  >
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className={pill('primary')}>
              Add to team
            </button>
            <button type="button" onClick={close} className={pill('secondary')}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-4 py-3 text-sm font-normal text-muted-foreground">
      {children}
    </th>
  );
}
