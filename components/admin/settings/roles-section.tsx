'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowPathIcon, PlusIcon } from '@heroicons/react/24/outline';
import { createRoleAction } from '@/app/admin/settings/team/actions';
import type { TeamPermissionKey, TeamRoleDefinition } from '@/lib/domain/schemas';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { pluralForm } from '@/lib/i18n/plural';
import { fieldClass, pill, tag } from '@/lib/ui';
import { Modal } from '@/components/site/modal';
import { AdminPageHeader } from '@/components/admin/shell/admin-page';
import { ClientPagination, paginateClient } from '@/components/admin/operations/client-pagination';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { permissions as allPermissions, roleLabel } from './team-data';
import { TeamTabs } from './team-tabs';

/**
 * Roles, built-in and custom, in the same row-grid every other admin list
 * uses (`TableCard`) rather than a tile-per-role card — and the one real
 * write on this page: create a role with a name and a subset of the fixed
 * permission list. Everything else here (inviting a member, editing one's
 * name) stays local-browser demo state — this one round-trips to
 * `createRoleAction`, which is what `requirePermission` actually consults
 * from then on, so a role made here really does gate `/admin` once a
 * member is moved onto it.
 */
export function RolesSection({ roles, membersCount }: { roles: TeamRoleDefinition[]; membersCount: number }) {
  const router = useRouter();
  const t = useAdminT();
  const locale = useAdminLocale();
  const permissionCount = (count: number) =>
    pluralForm(locale, count, {
      one: t('team.permissionCountOne', { count }),
      few: t('team.permissionCountFew', { count }),
      many: t('team.permissionCountMany', { count }),
      other: t('team.permissionCountOther', { count }),
    });
  const [page, setPage] = React.useState(1);
  const { pageItems, page: currentPage, totalPages } = paginateClient(roles, page);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [selected, setSelected] = React.useState<Set<TeamPermissionKey>>(new Set());
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const close = React.useCallback(() => {
    setOpen(false);
    setError('');
  }, []);

  function toggle(key: TeamPermissionKey) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const result = await createRoleAction({ name, permissions: [...selected] });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setName('');
    setSelected(new Set());
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <AdminPageHeader
        title={t('team.roles')}
        actions={
          <button type="button" onClick={() => setOpen(true)} className={pill('primary')}>
            <PlusIcon className="size-4" aria-hidden="true" />
            {t('team.createRole')}
          </button>
        }
      />
      <TeamTabs current="roles" counts={{ members: membersCount, roles: roles.length }} />

      <section aria-label={t('team.roles')} className="mt-8">
        <p className="text-sm text-muted-foreground">{t('team.rolesListBody')}</p>

      <div className="mt-5 overflow-hidden rounded-[18px] bg-card shadow-soft">
        <TableCard caption={t('team.roles')} className="min-w-[28rem]" attached>
          <thead>
            <tr className="border-b border-border">
              <Th>{t('team.roleName')}</Th>
              <Th>{t('team.rolePermissions')}</Th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((role) => (
              <tr key={role.id} className="border-b border-border last:border-b-0">
                <Td className="align-middle">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{roleLabel(role.id, roles, t)}</span>
                    {role.builtin ? <span className={tag()}>{t('team.builtin')}</span> : null}
                  </span>
                </Td>
                <Td className="align-middle text-muted-foreground">{permissionCount(role.permissions.length)}</Td>
              </tr>
            ))}
          </tbody>
        </TableCard>
        <ClientPagination page={currentPage} totalPages={totalPages} total={roles.length} onPageChange={setPage} attached />
      </div>

      <Modal open={open} onClose={close} title={t('team.createRole')}>
        <form onSubmit={create} noValidate className="grid gap-4">
          <p className="text-sm text-muted-foreground">{t('team.createRoleBody')}</p>
          <div>
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
          <fieldset>
            <legend className="mb-1.5 text-sm text-muted-foreground">{t('team.rolePermissions')}</legend>
            <ul className="grid gap-2">
              {allPermissions.map((permission) => (
                <li key={permission.key}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm hover:bg-stone">
                    <input
                      type="checkbox"
                      checked={selected.has(permission.key)}
                      onChange={() => toggle(permission.key)}
                      className="size-4 rounded border-border accent-primary"
                    />
                    {t(permission.key)}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          {error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={submitting} className={pill('primary')}>
              {submitting ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
              {t('team.createRole')}
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
