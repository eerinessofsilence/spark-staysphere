'use server';

import { revalidatePath } from 'next/cache';
import { AdminPermissionError, requirePermission } from '@/lib/application/admin-session';
import { teamService } from '@/lib/application/container';
import { teamPermissionKeySchema, type TeamPermissionKey, type TeamRoleDefinition } from '@/lib/domain/schemas';
import { getAdminT } from '@/lib/i18n/admin/server';
import { availableHotels } from '@/lib/application/container';

export interface TeamActionResult {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export interface CreateRoleResult extends TeamActionResult {
  role?: TeamRoleDefinition;
}

export async function createMemberAction(input: { name: string; email: string; role: string; hotelIds?: string[] }) {
  const t = await getAdminT();
  const denied = await requireRolePermission();
  if (denied) return { ...denied, member: undefined };
  const hotelIds = [...new Set(input.hotelIds ?? [])];
  if (hotelIds.some((id) => !availableHotels.some((hotel) => hotel.id === id))) return { ok: false, message: 'Invalid hotel assignment.', member: undefined };
  if (input.role === 'Hotelier' && hotelIds.length === 0) return { ok: false, message: 'Назначьте Hotelier хотя бы одному отелю.', member: undefined };
  const result = await teamService.createMember({ ...input, hotelIds: input.role === 'Hotelier' ? hotelIds : [] });
  if (!result.ok) {
    const keys = { nameRequired: 'team.userNameRequired', emailInvalid: 'team.emailInvalid', duplicate: 'team.alreadyOnTeam', roleNotFound: 'team.roleNotFound' } as const;
    return { ok: false, message: t(keys[result.error]), member: undefined };
  }
  revalidatePath('/admin/settings/team');
  return { ok: true, message: t('team.userCreated', { name: result.member.name }), member: result.member };
}

export async function updateRoleAction(input: {
  id: string;
  name: string;
  permissions: string[];
}): Promise<TeamActionResult> {
  const t = await getAdminT();
  const denied = await requireRolePermission();
  if (denied) return denied;

  const permissions = input.permissions.filter((key): key is TeamPermissionKey => teamPermissionKeySchema.safeParse(key).success);
  const result = await teamService.updateRole({ id: input.id, name: input.name, permissions });
  if (!result.ok) {
    const message =
      result.error === 'roleNotFound'
        ? t('team.roleNotFound')
        : result.error === 'nameRequired'
          ? t('team.roleNameRequired')
          : t('team.roleNeedsPermission');
    return { ok: false, message };
  }

  revalidatePath('/admin/settings/team/roles');
  revalidatePath('/admin/settings/team/roles/[id]', 'page');
  revalidatePath('/admin/settings/team');
  return { ok: true, message: t('team.roleUpdated') };
}

export async function deleteRoleAction(id: string): Promise<TeamActionResult> {
  const t = await getAdminT();
  const denied = await requireRolePermission();
  if (denied) return denied;

  const result = await teamService.deleteRole(id);
  if (!result.ok) {
    const message =
      result.error === 'roleNotFound'
        ? t('team.roleNotFound')
        : result.error === 'builtinRole'
          ? t('team.builtinRoleDeleteLocked')
          : t('team.roleInUse');
    return { ok: false, message };
  }

  revalidatePath('/admin/settings/team/roles');
  revalidatePath('/admin/settings/team');
  return { ok: true, message: t('team.roleDeleted') };
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

export async function setMemberHotelsAction(memberId: string, hotelIds: string[]): Promise<TeamActionResult> {
  const t = await getAdminT();
  const denied = await requireRolePermission();
  if (denied) return denied;
  const selected = [...new Set(hotelIds)];
  if (selected.some((id) => !availableHotels.some((hotel) => hotel.id === id))) return { ok: false, message: 'Invalid hotel assignment.' };
  if (!(await teamService.setMemberHotels(memberId, selected))) return { ok: false, message: t('team.memberNotFound') };
  revalidatePath('/admin/settings/team');
  revalidatePath('/admin/settings/team/[id]', 'page');
  return { ok: true, message: 'Hotel access updated.' };
}
