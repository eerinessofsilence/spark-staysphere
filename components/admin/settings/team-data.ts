export {
  builtinRoleKey,
  demoMembers,
  findMemberByEmail,
  findMemberById,
  hasBuiltinPermission,
  initialsOf,
  permissions,
  teamRoles,
  type BuiltinTeamRole,
  type TeamLastActiveKey,
  type TeamMember,
  type TeamPermissionKey,
  type TeamRole,
} from '@/lib/application/team-directory';
import type { TeamRoleDefinition } from '@/lib/domain/schemas';
import { builtinRoleKey, type TeamRole } from '@/lib/application/team-directory';
import type { AdminT } from '@/lib/i18n/admin/translate';

/**
 * A role's display name wherever one is shown: a built-in role's own
 * dictionary entry, translated, or — for a role made from
 * `/admin/settings/team` — the name it was given, which is data, not app
 * copy, so it is shown as typed in every language.
 */
export function roleLabel(role: TeamRole, roles: TeamRoleDefinition[], t: AdminT): string {
  const key = builtinRoleKey(role);
  if (key) return t(key);
  return roles.find((candidate) => candidate.id === role)?.name ?? role;
}
