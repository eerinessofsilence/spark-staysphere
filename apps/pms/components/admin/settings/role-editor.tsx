'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { updateRoleAction } from '@/app/admin/settings/team/actions';
import type { TeamPermissionKey, TeamRoleDefinition } from '@/lib/domain/schemas';
import { useAdminT } from '@/lib/i18n/admin/context';
import { fieldClass, pill, tag } from '@/lib/ui';
import { toast } from '@/components/admin/shell/toast';
import { permissions as allPermissions } from './team-data';

export function RoleEditor({ role }: { role: TeamRoleDefinition }) {
  const router = useRouter();
  const t = useAdminT();
  const [name, setName] = React.useState(role.name);
  const [selected, setSelected] = React.useState<Set<TeamPermissionKey>>(new Set(role.permissions));
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  function toggle(key: TeamPermissionKey) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const result = await updateRoleAction({ id: role.id, name, permissions: [...selected] });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    router.refresh();
  }

  return (
    <form onSubmit={save} noValidate className="rounded-[18px] bg-card p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">{t('team.editRoleBody')}</p>
        {role.builtin ? <span className={tag()}>{t('team.builtin')}</span> : null}
      </div>

      <div className="mt-6">
        <label htmlFor="role-name" className="mb-1.5 block text-sm text-muted-foreground">
          {t('team.roleName')}
        </label>
        <input
          id="role-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('team.roleNamePlaceholder')}
          className={fieldClass}
          autoComplete="off"
        />
      </div>

      <div role="group" aria-labelledby="role-permissions-label" className="mt-6">
        <p id="role-permissions-label" className="mb-1.5 text-sm text-muted-foreground">
          {t('team.rolePermissions')}
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {allPermissions.map((permission) => {
            const requiredForOwner = role.id === 'Owner' && permission.key === 'team.permTeamRoles';
            return (
              <li key={permission.key}>
                <label
                  className={`flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm ${
                    requiredForOwner ? 'cursor-default' : 'cursor-pointer hover:bg-stone'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(permission.key)}
                    disabled={requiredForOwner}
                    onChange={() => toggle(permission.key)}
                    className="disabled:opacity-70"
                  />
                  <span>
                    {t(permission.key)}
                    {requiredForOwner ? (
                      <span className="block text-xs text-muted-foreground">{t('team.ownerPermissionRequired')}</span>
                    ) : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      {error ? (
        <p role="alert" className="mt-5 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
        <button type="submit" disabled={submitting} className={pill('primary')}>
          {submitting ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
          {t('team.saveRole')}
        </button>
        <Link href="/admin/settings/team/roles" className={pill('secondary')}>
          {t('team.cancel')}
        </Link>
      </div>
    </form>
  );
}
