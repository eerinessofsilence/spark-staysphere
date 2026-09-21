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
  updateCustomRole(role) {
    const db = getDemoDatabase();
    return db ? d1.updateCustomRole(db, role) : mockRoleStore.updateCustomRole(role);
  },
  deleteCustomRole(id) {
    const db = getDemoDatabase();
    return db ? d1.deleteCustomRole(db, id) : mockRoleStore.deleteCustomRole(id);
  },
  countMemberRoleOverrides(roleId) {
    const db = getDemoDatabase();
    return db ? d1.countMemberRoleOverrides(db, roleId) : mockRoleStore.countMemberRoleOverrides(roleId);
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
