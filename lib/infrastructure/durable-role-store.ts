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
  listMembers() {
    const db = getDemoDatabase();
    return db ? d1.listMembers(db) : mockRoleStore.listMembers();
  },
  createMember(member) {
    const db = getDemoDatabase();
    return db ? d1.createMember(db, member) : mockRoleStore.createMember(member);
  },
  listRoleDefinitions() {
    const db = getDemoDatabase();
    return db ? d1.listRoleDefinitions(db) : mockRoleStore.listRoleDefinitions();
  },
  createRoleDefinition(role) {
    const db = getDemoDatabase();
    return db ? d1.createRoleDefinition(db, role) : mockRoleStore.createRoleDefinition(role);
  },
  upsertRoleDefinition(role) {
    const db = getDemoDatabase();
    return db ? d1.upsertRoleDefinition(db, role) : mockRoleStore.upsertRoleDefinition(role);
  },
  deleteRoleDefinition(id) {
    const db = getDemoDatabase();
    return db ? d1.deleteRoleDefinition(db, id) : mockRoleStore.deleteRoleDefinition(id);
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
