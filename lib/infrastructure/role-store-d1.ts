import type { TeamPermissionKey, TeamRoleDefinition } from '../domain/schemas';
import { ensureSchema } from './d1-schema';

/**
 * D1-backed half of `RoleStore` — custom role definitions and member role
 * overrides. Own tables, not columns on an existing one: there is no
 * migration runner to `ALTER` `bookings` or the (still hardcoded)
 * `demoMembers`, the same reasoning as `booking_stay_states`.
 */

interface TeamRoleRow {
  id: string;
  name: string;
  permissions: string;
}

function rowToRole(row: TeamRoleRow): TeamRoleDefinition {
  return {
    id: row.id,
    name: row.name,
    builtin: false,
    permissions: JSON.parse(row.permissions) as TeamPermissionKey[],
  };
}

export async function listCustomRoles(db: D1Database): Promise<TeamRoleDefinition[]> {
  await ensureSchema(db);
  const { results } = await db.prepare('SELECT id, name, permissions FROM team_roles ORDER BY created_at').all<TeamRoleRow>();
  return results.map(rowToRole);
}

export async function createCustomRole(db: D1Database, role: TeamRoleDefinition): Promise<TeamRoleDefinition> {
  await ensureSchema(db);
  await db
    .prepare('INSERT INTO team_roles (id, name, permissions, created_at) VALUES (?, ?, ?, ?)')
    .bind(role.id, role.name, JSON.stringify(role.permissions), new Date().toISOString())
    .run();
  return role;
}

export async function updateCustomRole(db: D1Database, role: TeamRoleDefinition): Promise<TeamRoleDefinition> {
  await ensureSchema(db);
  await db
    .prepare('UPDATE team_roles SET name = ?, permissions = ? WHERE id = ?')
    .bind(role.name, JSON.stringify(role.permissions), role.id)
    .run();
  return role;
}

export async function deleteCustomRole(db: D1Database, id: string): Promise<void> {
  await ensureSchema(db);
  await db.prepare('DELETE FROM team_roles WHERE id = ?').bind(id).run();
}

export async function countMemberRoleOverrides(db: D1Database, roleId: string): Promise<number> {
  await ensureSchema(db);
  const row = await db
    .prepare('SELECT COUNT(*) AS count FROM member_role_overrides WHERE role_id = ?')
    .bind(roleId)
    .first<{ count: number }>();
  return Number(row?.count ?? 0);
}

export async function getMemberRoleOverride(db: D1Database, memberId: string): Promise<string | null> {
  await ensureSchema(db);
  const row = await db
    .prepare('SELECT role_id FROM member_role_overrides WHERE member_id = ?')
    .bind(memberId)
    .first<{ role_id: string }>();
  return row?.role_id ?? null;
}

export async function setMemberRoleOverride(db: D1Database, memberId: string, roleId: string): Promise<void> {
  await ensureSchema(db);
  await db
    .prepare(
      `INSERT INTO member_role_overrides (member_id, role_id) VALUES (?, ?)
       ON CONFLICT (member_id) DO UPDATE SET role_id = excluded.role_id`,
    )
    .bind(memberId, roleId)
    .run();
}
