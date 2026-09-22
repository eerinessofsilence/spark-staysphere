import type { RoleStore } from '../domain/ports';
import type { TeamRoleDefinition } from '../domain/schemas';
import type { StoredTeamMember } from '../domain/team-member';

/**
 * Process-local fallback for `RoleStore` — the same semantics as
 * `role-store-d1.ts` so the two backends can't disagree, used whenever no D1
 * binding is configured (see `durable-role-store.ts`).
 */
const roleDefinitions = new Map<string, TeamRoleDefinition>();
const memberRoleOverrides = new Map<string, string>();
const members = new Map<string, StoredTeamMember>();

export const mockRoleStore: RoleStore = {
  async listMembers() { return [...members.values()]; },
  async createMember(member) {
    if ([...members.values()].some((existing) => existing.email.toLowerCase() === member.email.toLowerCase())) return false;
    members.set(member.id, member);
    return true;
  },
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
