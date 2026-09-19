import type { RoleStore } from '../domain/ports';
import { getDemoDatabase } from './cloudflare-env';
import * as d1 from './role-store-d1';
import { mockRoleStore } from './role-store-mock';

/**
 * The role store the app actually uses. Resolves the D1 binding at call
 * time and reads through D1 when one is configured, falling back to the
 * in-memory mock otherwise — same shape as `durable-spinner-markup.ts`.
 */
export const durableRoleStore: RoleStore = {
  listCustomRoles() {
    const db = getDemoDatabase();
    return db ? d1.listCustomRoles(db) : mockRoleStore.listCustomRoles();
  },
  createCustomRole(role) {
    const db = getDemoDatabase();
    return db ? d1.createCustomRole(db, role) : mockRoleStore.createCustomRole(role);
  },
  getMemberRoleOverride(memberId) {
    const db = getDemoDatabase();
    return db ? d1.getMemberRoleOverride(db, memberId) : mockRoleStore.getMemberRoleOverride(memberId);
  },
  setMemberRoleOverride(memberId, roleId) {
    const db = getDemoDatabase();
    return db ? d1.setMemberRoleOverride(db, memberId, roleId) : mockRoleStore.setMemberRoleOverride(memberId, roleId);
  },
};
