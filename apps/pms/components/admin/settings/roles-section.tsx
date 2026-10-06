'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu } from '@base-ui/react/menu';
import {
  ArrowPathIcon,
  EllipsisHorizontalIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { createRoleAction, deleteRoleAction } from '@/app/admin/settings/team/actions';
import type { TeamPermissionKey, TeamRoleDefinition } from '@/lib/domain/schemas';
import { useAdminLocale, useAdminT } from '@/lib/i18n/admin/context';
import { pluralForm } from '@/lib/i18n/plural';
import { fieldClass, pill, tag } from '@/lib/ui';
import { Modal } from '@/components/site/modal';
import { AdminPageHeader } from '@/components/admin/shell/admin-page';
import { CLIENT_PAGE_SIZE, ClientPagination, paginateClient } from '@/components/admin/operations/client-pagination';
import { TableCard, Td, Th } from '@/components/admin/operations/table';
import { toast } from '@/components/admin/shell/toast';
import { useUndoableDelete } from '@/components/admin/shell/undoable-delete';
import { permissions as allPermissions, roleLabel } from './team-data';
import { TeamTabs } from './team-tabs';

const menuItemClass =
  'flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none select-none data-highlighted:bg-stone data-disabled:cursor-not-allowed data-disabled:opacity-50';

function RoleActions({ role }: { role: TeamRoleDefinition }) {
  const router = useRouter();
  const deferDelete = useUndoableDelete();
  const t = useAdminT();
  const [confirming, setConfirming] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');

  const close = React.useCallback(() => {
    setConfirming(false);
    setError('');
  }, []);

  const remove = async () => {
    setPending(true);
    setError('');
    close();
    const result = await deferDelete(`role:${role.id}`, role.name, () => deleteRoleAction(role.id));
    setPending(false);
    if (!result) return;
    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }
    close();
    toast.success(result.message);
    router.refresh();
  };

  return (
    <>
      <Menu.Root modal={false}>
        <Menu.Trigger
          disabled={pending}
          openOnHover
          delay={80}
          closeDelay={150}
          aria-label={t('form.actionsFor', { label: role.name })}
          className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-stone hover:text-foreground data-popup-open:bg-stone data-popup-open:text-foreground"
        >
          <EllipsisHorizontalIcon className="size-5" aria-hidden="true" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50 outline-none">
            <Menu.Popup className="min-w-44 rounded-2xl border border-border bg-card p-1.5 text-foreground shadow-soft outline-none">
              <Menu.LinkItem
                render={<Link href={`/admin/settings/team/roles/${encodeURIComponent(role.id)}`} />}
                className={menuItemClass}
              >
                <PencilSquareIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {t('form.edit')}
              </Menu.LinkItem>
              <Menu.Item
                disabled={role.builtin}
                onClick={() => setConfirming(true)}
                className={`${menuItemClass} text-danger data-highlighted:bg-danger/10`}
              >
                <TrashIcon className="size-4 shrink-0" aria-hidden="true" />
                {t('form.delete')}
              </Menu.Item>
              {role.builtin ? (
                <p className="max-w-56 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  {t('team.builtinRoleDeleteLocked')}
                </p>
              ) : null}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <Modal open={confirming} onClose={close} title={t('form.removeLabel', { label: role.name })}>
        <p className="text-sm">{t('team.roleDeleteBody')}</p>
        {error ? (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={remove} disabled={pending} className={pill('primary')}>
            {pending ? <ArrowPathIcon className="size-4 animate-spin" aria-hidden="true" /> : null}
            {t('form.remove')}
          </button>
          <button type="button" onClick={close} className={pill('secondary')}>
            {t('form.keepIt')}
          </button>
        </div>
      </Modal>
    </>
  );
}

/**
 * Roles, built-in and custom, in the same row-grid every other admin list
 * uses (`TableCard`) rather than a tile-per-role card. Every role opens its
 * own editor; custom roles can also be created or removed here. Everything
 * else here (inviting a member, editing one's name) stays
 * local-browser demo state — role mutations round-trip to the role store,
 * which is what `requirePermission` actually consults from then on, so a
 * role made here really does gate `/admin` once a member is moved onto it.
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
  const [pageSize, setPageSize] = React.useState(CLIENT_PAGE_SIZE);
  const { pageItems, page: currentPage, totalPages } = paginateClient(roles, page, pageSize);
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [selected, setSelected] = React.useState<Set<TeamPermissionKey>>(new Set());
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const close = React.useCallback(() => {
    setOpen(false);
    setError('');
  }, []);

  function startCreate() {
    setName('');
    setSelected(new Set());
    setError('');
    setOpen(true);
  }

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
          <button type="button" onClick={startCreate} className={pill('primary')}>
            <PlusIcon className="size-4" aria-hidden="true" />
            {t('team.createRole')}
          </button>
        }
      />
      <TeamTabs current="roles" counts={{ members: membersCount, roles: roles.length }} />

      <section aria-label={t('team.roles')} className="mt-8">
      <div className="overflow-hidden rounded-[18px] bg-card shadow-soft">
        <TableCard caption={t('team.roles')} className="min-w-[28rem]" attached>
          <thead>
            <tr className="border-b border-border">
              <Th>{t('team.roleName')}</Th>
              <Th>{t('team.rolePermissions')}</Th>
              <Th className="w-14">
                <span className="sr-only">{t('form.actionsFor', { label: t('team.roles') })}</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((role) => {
              const label = roleLabel(role.id, roles, t);
              const identity = (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{label}</span>
                  {role.builtin ? <span className={tag()}>{t('team.builtin')}</span> : null}
                </span>
              );
              return (
                <tr
                  key={role.id}
                  className="relative border-b border-border transition-colors last:border-b-0 hover:bg-stone/50"
                >
                  <Td>
                    <Link
                      href={`/admin/settings/team/roles/${encodeURIComponent(role.id)}`}
                      aria-label={`${t('team.editRole')}: ${label}`}
                      className="text-left before:absolute before:inset-0"
                    >
                      {identity}
                    </Link>
                  </Td>
                  <Td className="text-muted-foreground">{permissionCount(role.permissions.length)}</Td>
                  <Td className="relative z-10 w-14 text-right">
                    <RoleActions role={role} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableCard>
        <ClientPagination
          page={currentPage}
          totalPages={totalPages}
          total={roles.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          attached
        />
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
                  <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm hover:bg-stone">
                    <input
                      type="checkbox"
                      checked={selected.has(permission.key)}
                      onChange={() => toggle(permission.key)}
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
