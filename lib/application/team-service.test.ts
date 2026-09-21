import { beforeEach, describe, expect, it } from 'vitest';
import type { RoleStore } from '@/lib/domain/ports';
import type { TeamPermissionKey, TeamRoleDefinition } from '@/lib/domain/schemas';
import { TeamService } from './team-service';

const roleDefinitions = new Map<string, TeamRoleDefinition>();
const memberRoleOverrides = new Map<string, string>();

const roleStore: RoleStore = {
  async listRoleDefinitions() {
    return [...roleDefinitions.values()];
  },
  async createRoleDefinition(role) {
    roleDefinitions.set(role.id, role);
    return role;
  },
  async upsertRoleDefinition(role) {
    roleDefinitions.set(role.id, role);
    return role;
  },
  async deleteRoleDefinition(id) {
    roleDefinitions.delete(id);
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
const manageTeam: TeamPermissionKey = 'team.permTeamRoles';

describe('TeamService custom roles', () => {
  beforeEach(() => {
    roleDefinitions.clear();
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

  it('updates a built-in role but does not allow it to be removed', async () => {
    const service = new TeamService(roleStore);

    expect(await service.updateRole({ id: 'Owner', name: 'Property owner', permissions: [viewBookings] })).toEqual({
      ok: true,
      role: { id: 'Owner', name: 'Property owner', builtin: true, permissions: [viewBookings, manageTeam] },
    });
    expect((await service.listRoles()).find((role) => role.id === 'Owner')).toEqual({
      id: 'Owner',
      name: 'Property owner',
      builtin: true,
      permissions: [viewBookings, manageTeam],
    });
    expect(await service.hasPermission('Owner', viewBookings)).toBe(true);
    expect(await service.hasPermission('Owner', editContent)).toBe(false);
    expect(await service.hasPermission('Owner', manageTeam)).toBe(true);
    expect(await service.deleteRole('Owner')).toEqual({ ok: false, error: 'builtinRole' });
  });

  it('repairs an owner override that already removed role management', async () => {
    roleDefinitions.set('Owner', {
      id: 'Owner',
      name: 'Property owner',
      builtin: true,
      permissions: [viewBookings],
    });
    const service = new TeamService(roleStore);

    expect(await service.hasPermission('Owner', manageTeam)).toBe(true);
    expect((await service.listRoles()).find((role) => role.id === 'Owner')?.permissions).toEqual([
      viewBookings,
      manageTeam,
    ]);
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
