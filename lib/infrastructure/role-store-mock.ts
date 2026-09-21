import type { RoleStore } from '../domain/ports';
import type { TeamRoleDefinition } from '../domain/schemas';

/**
 * Process-local fallback for `RoleStore` — the same semantics as
 * `role-store-d1.ts` so the two backends can't disagree, used whenever no D1
 * binding is configured (see `durable-role-store.ts`).
 */
const roleDefinitions = new Map<string, TeamRoleDefinition>();
const memberRoleOverrides = new Map<string, string>();

export const mockRoleStore: RoleStore = {
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
