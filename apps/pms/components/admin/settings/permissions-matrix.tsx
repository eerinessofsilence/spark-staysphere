'use client';

import { CheckIcon, MinusIcon } from '@heroicons/react/24/outline';
import type { TeamRoleDefinition } from '@/lib/domain/schemas';
import { useAdminT } from '@/lib/i18n/admin/context';
import { permissions, roleLabel } from './team-data';

/** All roles — built-in and custom — and what each is allowed, read straight off `TeamRoleDefinition.permissions` rather than the built-ins' own `allowed` list, so a role created in `/admin/settings/team` shows up the same way. */
export function PermissionsMatrix({ roles }: { roles: TeamRoleDefinition[] }) {
  const t = useAdminT();
  return (
    <section aria-labelledby="roles-heading">
      <h2 id="roles-heading" className="text-display text-3xl">
        {t('team.rolesPermissions')}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('team.rolesBody')}</p>
      <div className="relative mt-5 overflow-x-auto rounded-[18px] bg-card shadow-soft contain-inline-size">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <caption className="sr-only">{t('team.permissionsCaption')}</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="px-4 py-3 font-normal text-muted-foreground">
                {t('team.thPermission')}
              </th>
              {roles.map((role) => (
                <th key={role.id} scope="col" className="px-4 py-3 text-center font-normal text-muted-foreground">
                  {roleLabel(role.id, roles, t)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => (
              <tr key={permission.key} className="border-b border-border last:border-b-0">
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  {t(permission.key)}
                </th>
                {roles.map((role) => {
                  const allowed = role.permissions.includes(permission.key);
                  return (
                    <td key={role.id} className="px-4 py-3 text-center">
                      {allowed ? (
                        <CheckIcon className="mx-auto size-5 text-success" aria-hidden="true" />
                      ) : (
                        <MinusIcon className="mx-auto size-5 text-muted-foreground/60" aria-hidden="true" />
                      )}
                      <span className="sr-only">{allowed ? t('team.allowed') : t('team.notAllowed')}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
