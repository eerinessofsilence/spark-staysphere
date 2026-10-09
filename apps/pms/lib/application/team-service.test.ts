import { beforeEach, describe, expect, it } from 'vitest';
import type { RoleStore } from '@/lib/domain/ports';
import type { TeamPermissionKey, TeamRoleDefinition } from '@/lib/domain/schemas';
import { TeamService } from './team-service';
import type { StoredTeamMember } from '../domain/team-member';

const roleDefinitions = new Map<string, TeamRoleDefinition>();
const memberRoleOverrides = new Map<string, string>();
const memberHotelIds = new Map<string, string[]>();
const memberHotelScopes = new Set<string>();
const members = new Map<string, StoredTeamMember>();

const roleStore: RoleStore = {
  async listMembers() { return [...members.values()]; },
  async createMember(member) {
    if ([...members.values()].some((existing) => existing.email === member.email)) return false;
    members.set(member.id, member);
    return true;
  },
  async listMemberHotelIds(memberId) { return memberHotelIds.get(memberId) ?? []; },
  async hasMemberHotelScope(memberId) { return memberHotelScopes.has(memberId); },
  async setMemberHotelIds(memberId, hotelIds) { memberHotelScopes.add(memberId); memberHotelIds.set(memberId, [...hotelIds]); },
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
    members.clear();
    roleDefinitions.clear();
    memberRoleOverrides.clear();
    memberHotelIds.clear();
    memberHotelScopes.clear();
  });

  it('creates a durable active member and resolves sign-in email and role overrides', async () => {
    const service = new TeamService(roleStore);
    const result = await service.createMember({ name: ' New User ', email: ' NEW@example.com ', role: 'Front desk' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const reloaded = new TeamService(roleStore);
    expect(await reloaded.findMemberByEmail('NEW@example.com')).toMatchObject({ name: 'New User', status: 'active' });
    expect(await reloaded.listMembers()).toHaveLength(8);
    await reloaded.setMemberRole(result.member.id, 'Content editor');
    expect(await reloaded.findMemberById(result.member.id)).toMatchObject({ role: 'Content editor' });
  });

  it('persists hotel-scoped membership for a Hotelier', async () => {
    const service = new TeamService(roleStore);
    const result = await service.createMember({ name: 'Hotelier', email: 'hotel@example.com', role: 'Hotelier', hotelIds: ['hotel-1'] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await service.findMemberById(result.member.id)).toMatchObject({ role: 'Hotelier', hotelIds: ['hotel-1'] });
  });

  it('validates user input and refuses seed, stored and concurrent duplicate emails', async () => {
    const service = new TeamService(roleStore);
    const input = { name: 'New user', email: 'new@example.com', role: 'Front desk' };
    expect(await service.createMember({ ...input, name: ' ' })).toMatchObject({ error: 'nameRequired' });
    expect(await service.createMember({ ...input, email: 'invalid' })).toMatchObject({ error: 'emailInvalid' });
    expect(await service.createMember({ ...input, role: 'unknown' })).toMatchObject({ error: 'roleNotFound' });
    expect(await service.createMember({ ...input, email: 'ELENA.MARKOU@asteriacove.example' })).toMatchObject({ error: 'duplicate' });
    const results = await Promise.all([service.createMember(input), service.createMember(input)]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await service.createMember({ ...input, email: 'NEW@example.com' })).toMatchObject({ error: 'duplicate' });
  });

  it('does not delete a role assigned to a created user', async () => {
    const service = new TeamService(roleStore);
    const role = await service.createRole({ name: 'New role', permissions: ['team.permViewBookings'] });
    if (!role.ok) throw new Error('Role setup failed');
    await service.createMember({ name: 'User', email: 'new@example.com', role: role.role.id });
    expect(await service.deleteRole(role.role.id)).toEqual({ ok: false, error: 'inUse' });
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
