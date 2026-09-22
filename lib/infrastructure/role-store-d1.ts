import type { TeamPermissionKey, TeamRoleDefinition } from '../domain/schemas';
import { ensureSchema } from './d1-schema';
import type { StoredTeamMember } from '../domain/team-member';

export async function listMembers(db: D1Database): Promise<StoredTeamMember[]> {
  await ensureSchema(db);
  const { results } = await db.prepare('SELECT id, name, email, role FROM team_members ORDER BY rowid').all<StoredTeamMember>();
  return results;
}

export async function createMember(db: D1Database, member: StoredTeamMember): Promise<boolean> {
  await ensureSchema(db);
  const result = await db.prepare('INSERT INTO team_members (id, name, email, role) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO NOTHING')
    .bind(member.id, member.name, member.email, member.role).run();
  return result.meta.changes === 1;
}

/**
 * D1-backed half of `RoleStore` — custom role definitions, built-in role
 * edits, and member role overrides. Own tables, not columns on an existing one: there is no
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

export async function listRoleDefinitions(db: D1Database): Promise<TeamRoleDefinition[]> {
  await ensureSchema(db);
  const { results } = await db.prepare('SELECT id, name, permissions FROM team_roles ORDER BY created_at').all<TeamRoleRow>();
  return results.map(rowToRole);
}

export async function createRoleDefinition(db: D1Database, role: TeamRoleDefinition): Promise<TeamRoleDefinition> {
  await ensureSchema(db);
  await db
    .prepare('INSERT INTO team_roles (id, name, permissions, created_at) VALUES (?, ?, ?, ?)')
    .bind(role.id, role.name, JSON.stringify(role.permissions), new Date().toISOString())
    .run();
  return role;
}

export async function upsertRoleDefinition(db: D1Database, role: TeamRoleDefinition): Promise<TeamRoleDefinition> {
  await ensureSchema(db);
  await db
    .prepare(
      `INSERT INTO team_roles (id, name, permissions, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET name = excluded.name, permissions = excluded.permissions`,
    )
    .bind(role.id, role.name, JSON.stringify(role.permissions), new Date().toISOString())
    .run();
  return role;
}

export async function deleteRoleDefinition(db: D1Database, id: string): Promise<void> {
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
