import type { RoleStore } from '../domain/ports';
import { z } from 'zod';
import type { TeamPermissionKey, TeamRoleDefinition } from '../domain/schemas';
import { kebabSuggestion } from '../domain/slug';
import {
  demoMembers,
  findMemberByEmail as findBuiltinMemberByEmail,
  findMemberById as findBuiltinMemberById,
  permissions as builtinGrants,
  teamRoles,
  type TeamMember,
  type TeamRole,
} from './team-directory';

/** Next after `base`, `base-2`, `base-3`, … — same shape as `content-service.ts`'s `uniqueId`. */
function uniqueRoleId(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function builtinRoleDefinitions(): TeamRoleDefinition[] {
  return teamRoles.map((role) => ({
    id: role,
    name: role,
    builtin: true,
    permissions: builtinGrants.filter((grant) => grant.allowed.includes(role)).map((grant) => grant.key),
  }));
}

const ownerRoleId = 'Owner';
const ownerRequiredPermission: TeamPermissionKey = 'team.permTeamRoles';

/** The owner must always retain the one permission that can repair every other role grant. */
function preserveOwnerAccess(role: TeamRoleDefinition): TeamRoleDefinition {
  if (role.id !== ownerRoleId || role.permissions.includes(ownerRequiredPermission)) return role;
  return { ...role, permissions: [...role.permissions, ownerRequiredPermission] };
}

export type CreateRoleError = 'nameRequired' | 'noPermissions';
export type UpdateRoleError = 'roleNotFound' | 'nameRequired' | 'noPermissions';
export type DeleteRoleError = 'roleNotFound' | 'builtinRole' | 'inUse';
export type SetMemberRoleError = 'memberNotFound' | 'roleNotFound';

/**
 * The one place that knows a role can be either one of the five seeded
 * definitions or one made from `/admin/settings/team` — `admin-session.ts`'s
 * `requirePermission` is this class's only consumer that matters, since
 * that's the check a custom role actually has to survive to be real rather
 * than decorative. The roster combines seeded members and durably created
 * accounts. Also durable are role assignments, custom roles, and edits to seeded
 * roles — all in `RoleStore` (D1, or in-memory without a binding).
 */
export class TeamService {
  constructor(private readonly roles: RoleStore) {}

  async createMember(input: { name: string; email: string; role: string; hotelIds?: string[] }): Promise<
    { ok: true; member: TeamMember } | { ok: false; error: 'nameRequired' | 'emailInvalid' | 'duplicate' | 'roleNotFound' }
  > {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (!name || name.length > 120) return { ok: false, error: 'nameRequired' };
    if (!z.email().max(254).safeParse(email).success) return { ok: false, error: 'emailInvalid' };
    if (!(await this.listRoles()).some((role) => role.id === input.role)) return { ok: false, error: 'roleNotFound' };
    if (await this.findMemberByEmail(email)) return { ok: false, error: 'duplicate' };
    const hotelIds = [...new Set(input.hotelIds ?? [])];
    const member: TeamMember = { id: `member-${crypto.randomUUID()}`, name, email, role: input.role, status: 'active', lastActive: 'team.notSignedIn', hotelIds };
    if (!(await this.roles.createMember({ id: member.id, name, email, role: member.role }))) return { ok: false, error: 'duplicate' };
    if (hotelIds.length) await this.roles.setMemberHotelIds(member.id, hotelIds);
    return { ok: true, member };
  }

  async listRoles(): Promise<TeamRoleDefinition[]> {
    const stored = await this.roles.listRoleDefinitions();
    const storedById = new Map(stored.map((role) => [role.id, role]));
    const builtinIds = new Set<string>(teamRoles);
    const builtin = builtinRoleDefinitions().map((role) => {
      const override = storedById.get(role.id);
      return preserveOwnerAccess(override ? { ...override, builtin: true } : role);
    });
    const custom = stored.filter((role) => !builtinIds.has(role.id)).map((role) => ({ ...role, builtin: false }));
    return [...builtin, ...custom];
  }

  async createRole(input: {
    name: string;
    permissions: TeamPermissionKey[];
  }): Promise<{ ok: true; role: TeamRoleDefinition } | { ok: false; error: CreateRoleError }> {
    const name = input.name.trim();
    if (!name) return { ok: false, error: 'nameRequired' };
    if (input.permissions.length === 0) return { ok: false, error: 'noPermissions' };

    const existing = await this.listRoles();
    const id = uniqueRoleId(kebabSuggestion(name) || 'role', new Set(existing.map((role) => role.id)));
    const role: TeamRoleDefinition = { id, name, builtin: false, permissions: input.permissions };
    await this.roles.createRoleDefinition(role);
    return { ok: true, role };
  }

  async updateRole(input: {
    id: string;
    name: string;
    permissions: TeamPermissionKey[];
  }): Promise<{ ok: true; role: TeamRoleDefinition } | { ok: false; error: UpdateRoleError }> {
    const current = (await this.listRoles()).find((role) => role.id === input.id);
    if (!current) return { ok: false, error: 'roleNotFound' };
    const name = input.name.trim();
    if (!name) return { ok: false, error: 'nameRequired' };
    if (input.permissions.length === 0) return { ok: false, error: 'noPermissions' };

    const role = preserveOwnerAccess({ ...current, name, permissions: input.permissions });
    await this.roles.upsertRoleDefinition(role);
    return { ok: true, role };
  }

  async deleteRole(id: string): Promise<{ ok: true } | { ok: false; error: DeleteRoleError }> {
    const current = (await this.listRoles()).find((role) => role.id === id);
    if (!current) return { ok: false, error: 'roleNotFound' };
    if (current.builtin) return { ok: false, error: 'builtinRole' };
    if ((await this.roles.countMemberRoleOverrides(id)) > 0 || (await this.listMembers()).some((member) => member.role === id)) return { ok: false, error: 'inUse' };

    await this.roles.deleteRoleDefinition(id);
    return { ok: true };
  }

  /** `demoMembers`'s own role, or whatever it's been overridden to from a member's own page. */
  async findMemberById(id: string): Promise<TeamMember | null> {
    const stored = (await this.roles.listMembers()).find((candidate) => candidate.id === id);
    const member: TeamMember | null = findBuiltinMemberById(id) ?? (stored ? { ...stored, status: 'active', lastActive: 'team.notSignedIn' } : null);
    if (!member) return null;
    const [override, storedHotelIds, hasHotelScope] = await Promise.all([this.roles.getMemberRoleOverride(id), this.roles.listMemberHotelIds(id), this.roles.hasMemberHotelScope(id)]);
    return { ...member, ...(override ? { role: override } : {}), hotelIds: hasHotelScope ? storedHotelIds : (member.hotelIds ?? []) };
  }

  /** Seeded and created accounts, with their current role overrides applied. */
  async listMembers(): Promise<TeamMember[]> {
    const created: TeamMember[] = (await this.roles.listMembers()).map((member) => ({ ...member, status: 'active', lastActive: 'team.notSignedIn' }));
    return Promise.all([...demoMembers, ...created].map(async (member) => {
      const [role, hotelIds, hasHotelScope] = await Promise.all([this.roles.getMemberRoleOverride(member.id), this.roles.listMemberHotelIds(member.id), this.roles.hasMemberHotelScope(member.id)]);
      return { ...member, ...(role ? { role } : {}), hotelIds: hasHotelScope ? hotelIds : (member.hotelIds ?? []) };
    }));
  }

  async setMemberHotels(memberId: string, hotelIds: string[]): Promise<boolean> {
    if (!(await this.findMemberById(memberId))) return false;
    await this.roles.setMemberHotelIds(memberId, [...new Set(hotelIds)]);
    return true;
  }

  async findMemberByEmail(email: string): Promise<TeamMember | null> {
    const member = findBuiltinMemberByEmail(email) ?? (await this.roles.listMembers()).find((candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase());
    return member ? this.findMemberById(member.id) : null;
  }

  async setMemberRole(
    memberId: string,
    roleId: TeamRole,
  ): Promise<{ ok: true } | { ok: false; error: SetMemberRoleError }> {
    if (!(await this.findMemberById(memberId))) return { ok: false, error: 'memberNotFound' };
    const roles = await this.listRoles();
    if (!roles.some((role) => role.id === roleId)) return { ok: false, error: 'roleNotFound' };
    await this.roles.setMemberRoleOverride(memberId, roleId);
    return { ok: true };
  }

  /** The actual gate: every role uses the current definition returned by `listRoles`, including stored edits to a built-in one. */
  async hasPermission(role: TeamRole, key: TeamPermissionKey): Promise<boolean> {
    const roles = await this.listRoles();
    return roles.find((candidate) => candidate.id === role)?.permissions.includes(key) ?? false;
  }

  async permissionsForRole(role: TeamRole): Promise<TeamPermissionKey[]> {
    return (await this.listRoles()).find((candidate) => candidate.id === role)?.permissions ?? [];
  }
}
