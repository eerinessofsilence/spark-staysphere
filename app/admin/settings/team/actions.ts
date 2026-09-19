'use server';

import { revalidatePath } from 'next/cache';
import { AdminPermissionError, requirePermission } from '@/lib/application/admin-session';
import { teamService } from '@/lib/application/container';
import { teamPermissionKeySchema, type TeamPermissionKey, type TeamRoleDefinition } from '@/lib/domain/schemas';
import { getAdminT } from '@/lib/i18n/admin/server';

export interface TeamActionResult {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export interface CreateRoleResult extends TeamActionResult {
  role?: TeamRoleDefinition;
}

/** Roles are the same permission `/admin/settings/team` shows deciding them — creating one is at least as sensitive as changing who has it. */
async function requireRolePermission() {
  const t = await getAdminT();
  try {
    await requirePermission('team.permTeamRoles');
    return null;
  } catch (error) {
    if (error instanceof AdminPermissionError) return { ok: false as const, message: t('team.permissionDenied') };
    throw error;
  }
}

export async function createRoleAction(input: { name: string; permissions: string[] }): Promise<CreateRoleResult> {
  const t = await getAdminT();
  const denied = await requireRolePermission();
  if (denied) return denied;

  const name = input.name.trim();
  if (!name) return { ok: false, message: t('team.roleNameRequired'), fieldErrors: { name: [t('team.roleNameRequired')] } };

  const permissions = input.permissions.filter((key): key is TeamPermissionKey => teamPermissionKeySchema.safeParse(key).success);
  if (permissions.length === 0) {
    return { ok: false, message: t('team.roleNeedsPermission'), fieldErrors: { permissions: [t('team.roleNeedsPermission')] } };
  }

  const result = await teamService.createRole({ name, permissions });
  if (!result.ok) {
    const message = result.error === 'nameRequired' ? t('team.roleNameRequired') : t('team.roleNeedsPermission');
    return { ok: false, message };
  }

  revalidatePath('/admin/settings/team');
  return { ok: true, message: t('team.roleCreated', { name: result.role.name }), role: result.role };
}

export async function setMemberRoleAction(memberId: string, roleId: string): Promise<TeamActionResult> {
  const t = await getAdminT();
  const denied = await requireRolePermission();
  if (denied) return denied;

  const result = await teamService.setMemberRole(memberId, roleId);
  if (!result.ok) {
    return { ok: false, message: result.error === 'memberNotFound' ? t('team.memberNotFound') : t('team.roleNotFound') };
  }

  revalidatePath('/admin/settings/team');
  revalidatePath('/admin/settings/team/[id]', 'page');
  return { ok: true, message: t('team.roleUpdated') };
}
