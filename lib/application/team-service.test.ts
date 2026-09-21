import { beforeEach, describe, expect, it } from 'vitest';
import type { RoleStore } from '@/lib/domain/ports';
import type { TeamPermissionKey, TeamRoleDefinition } from '@/lib/domain/schemas';
import { TeamService } from './team-service';

const customRoles = new Map<string, TeamRoleDefinition>();
const memberRoleOverrides = new Map<string, string>();

const roleStore: RoleStore = {
  async listCustomRoles() {
    return [...customRoles.values()];
  },
  async createCustomRole(role) {
    customRoles.set(role.id, role);
    return role;
  },
  async updateCustomRole(role) {
    customRoles.set(role.id, role);
    return role;
  },
  async deleteCustomRole(id) {
    customRoles.delete(id);
  },
  async countMemberRoleOverrides(roleId) {
    return [...memberRoleOverrides.values()].filter((assignedRoleId) => assignedRoleId === roleId).length;
  },
  async getMemberRoleOverride(memberId) {
    return memberRoleOverrides.get(memberId) ?? null;
  },
  async setMemberRoleOverride(memberId, roleId) {
    memberRoleOverrides.set(memberId, roleId);
  },
};

const viewBookings: TeamPermissionKey = 'team.permViewBookings';
const editContent: TeamPermissionKey = 'team.permEditContent';

describe('TeamService custom roles', () => {
  beforeEach(() => {
    customRoles.clear();
    memberRoleOverrides.clear();
  });

  it('updates a custom role without changing its id', async () => {
    const service = new TeamService(roleStore);
    const created = await service.createRole({ name: 'Night manager', permissions: [viewBookings] });

    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await service.updateRole({
      id: created.role.id,
      name: 'Late shift manager',
      permissions: [viewBookings, editContent],
    });

    expect(result).toEqual({
      ok: true,
      role: {
        id: created.role.id,
        name: 'Late shift manager',
        builtin: false,
        permissions: [viewBookings, editContent],
      },
    });
  });

  it('does not allow built-in roles to be changed or removed', async () => {
    const service = new TeamService(roleStore);

    expect(await service.updateRole({ id: 'Owner', name: 'Other', permissions: [viewBookings] })).toEqual({
      ok: false,
      error: 'builtinRole',
    });
    expect(await service.deleteRole('Owner')).toEqual({ ok: false, error: 'builtinRole' });
  });

  it('does not remove a custom role while a member is assigned to it', async () => {
    const service = new TeamService(roleStore);
    const created = await service.createRole({ name: 'Night manager', permissions: [viewBookings] });
    if (!created.ok) throw new Error('role was not created');

    await roleStore.setMemberRoleOverride('member-1', created.role.id);
    expect(await service.deleteRole(created.role.id)).toEqual({ ok: false, error: 'inUse' });

    await roleStore.setMemberRoleOverride('member-1', 'Front desk');
    expect(await service.deleteRole(created.role.id)).toEqual({ ok: true });
    expect(await service.listRoles()).not.toContainEqual(created.role);
  });
});
