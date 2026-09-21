import type { RoleStore } from '../domain/ports';
import type { TeamPermissionKey, TeamRoleDefinition } from '../domain/schemas';
import { kebabSuggestion } from '../domain/slug';
import {
  demoMembers,
  findMemberByEmail as findBuiltinMemberByEmail,
  findMemberById as findBuiltinMemberById,
  hasBuiltinPermission,
  permissions as builtinGrants,
  teamRoles,
  type BuiltinTeamRole,
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

export type CreateRoleError = 'nameRequired' | 'noPermissions';
export type UpdateRoleError = 'roleNotFound' | 'builtinRole' | 'nameRequired' | 'noPermissions';
export type DeleteRoleError = 'roleNotFound' | 'builtinRole' | 'inUse';
export type SetMemberRoleError = 'memberNotFound' | 'roleNotFound';

/**
 * The one place that knows a role can be either of the five built into the
 * code or one made from `/admin/settings/team` — `admin-session.ts`'s
 * `requirePermission` is this class's only consumer that matters, since
 * that's the check a custom role actually has to survive to be real rather
 * than decorative. `demoMembers` itself stays exactly as fixed and
 * unpersisted as before (see its own doc comment); what's durable here is
 * only the *role* a member has been moved onto, and the custom roles
 * themselves — both in `RoleStore` (D1, or in-memory without a binding).
 */
export class TeamService {
  constructor(private readonly roles: RoleStore) {}

  async listRoles(): Promise<TeamRoleDefinition[]> {
    const custom = await this.roles.listCustomRoles();
    return [...builtinRoleDefinitions(), ...custom];
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
    await this.roles.createCustomRole(role);
    return { ok: true, role };
  }

  async updateRole(input: {
    id: string;
    name: string;
    permissions: TeamPermissionKey[];
  }): Promise<{ ok: true; role: TeamRoleDefinition } | { ok: false; error: UpdateRoleError }> {
    const current = (await this.listRoles()).find((role) => role.id === input.id);
    if (!current) return { ok: false, error: 'roleNotFound' };
    if (current.builtin) return { ok: false, error: 'builtinRole' };
    const name = input.name.trim();
    if (!name) return { ok: false, error: 'nameRequired' };
    if (input.permissions.length === 0) return { ok: false, error: 'noPermissions' };

    const role: TeamRoleDefinition = { ...current, name, permissions: input.permissions };
    await this.roles.updateCustomRole(role);
    return { ok: true, role };
  }

  async deleteRole(id: string): Promise<{ ok: true } | { ok: false; error: DeleteRoleError }> {
    const current = (await this.listRoles()).find((role) => role.id === id);
    if (!current) return { ok: false, error: 'roleNotFound' };
    if (current.builtin) return { ok: false, error: 'builtinRole' };
    if ((await this.roles.countMemberRoleOverrides(id)) > 0) return { ok: false, error: 'inUse' };

    await this.roles.deleteCustomRole(id);
    return { ok: true };
  }

  /** `demoMembers`'s own role, or whatever it's been overridden to from a member's own page. */
  async findMemberById(id: string): Promise<TeamMember | null> {
    const member = findBuiltinMemberById(id);
    if (!member) return null;
    const override = await this.roles.getMemberRoleOverride(id);
    return override ? { ...member, role: override } : member;
  }

  /** The seed roster, each with its role override applied — what `/admin/settings/team`'s member table actually shows, not the raw seed `TeamMembers` used to read directly. */
  async listMembers(): Promise<TeamMember[]> {
    return Promise.all(demoMembers.map((member) => this.findMemberById(member.id))).then(
      (members) => members.filter((member): member is TeamMember => member !== null),
    );
  }

  async findMemberByEmail(email: string): Promise<TeamMember | null> {
    const member = findBuiltinMemberByEmail(email);
    return member ? this.findMemberById(member.id) : null;
  }

  async setMemberRole(
    memberId: string,
    roleId: TeamRole,
  ): Promise<{ ok: true } | { ok: false; error: SetMemberRoleError }> {
    if (!findBuiltinMemberById(memberId)) return { ok: false, error: 'memberNotFound' };
    const roles = await this.listRoles();
    if (!roles.some((role) => role.id === roleId)) return { ok: false, error: 'roleNotFound' };
    await this.roles.setMemberRoleOverride(memberId, roleId);
    return { ok: true };
  }

  /**
   * The actual gate: a built-in role's grant is fixed in code
   * (`hasBuiltinPermission`), a custom one's is whatever it was created
   * with. Either way, a role not listed for `key` is refused it.
   */
  async hasPermission(role: TeamRole, key: TeamPermissionKey): Promise<boolean> {
    if (teamRoles.includes(role as BuiltinTeamRole)) return hasBuiltinPermission(role as BuiltinTeamRole, key);
    const roles = await this.roles.listCustomRoles();
    return roles.find((candidate) => candidate.id === role)?.permissions.includes(key) ?? false;
  }
}
