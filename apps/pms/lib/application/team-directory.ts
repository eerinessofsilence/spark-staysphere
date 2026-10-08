import type { TeamPermissionKey } from '../domain/schemas';

export type { TeamPermissionKey };

/**
 * Who can sign in to the back office. Demo data, the same team members the
 * team screen lists (`components/admin/settings/team-data.ts` re-exports
 * this) — a real deployment replaces it with an identity provider behind
 * the same two calls, `findMemberByEmail` and `findMemberById`, which is
 * all `admin-session.ts` ever asks of it (through `TeamService`, which
 * overlays a member's stored role on top of what's returned here — see
 * `team-service.ts`).
 */

/** The seeded role ids. Their default names and permissions live here, while `TeamService` overlays edits saved from `/admin/settings/team`. */
export const teamRoles = ['Owner', 'General manager', 'Revenue manager', 'Front desk', 'Content editor', 'Housekeeper', 'Hotelier'] as const;

export type BuiltinTeamRole = (typeof teamRoles)[number];

/** A member's `role` is an id: a built-in name above, or a custom role's generated id — both resolve through `TeamService.listRoles`. */
export type TeamRole = string;

/** "Last active" is fixed demo data, so each value is a dictionary key rather than a timestamp run through `lRelativeTime`. */
export type TeamLastActiveKey =
  | 'team.activeToday'
  | 'team.activeYesterday'
  | 'team.active2DaysAgo'
  | 'team.active3HoursAgo'
  | 'team.notSignedIn';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  status: 'active' | 'invited';
  lastActive: TeamLastActiveKey;
  /** Added from the invite dialog in this browser; never sent anywhere. */
  demoInvite?: boolean;
  /** Properties this member is explicitly assigned to for hotel-scoped workflows. */
  hotelIds?: string[];
}

export const demoMembers: TeamMember[] = [
  {
    id: 'elena',
    name: 'Elena Markou',
    email: 'elena.markou@asteriacove.example',
    role: 'Owner',
    status: 'active',
    lastActive: 'team.activeToday',
  },
  {
    id: 'andreas',
    name: 'Andreas Christou',
    email: 'andreas.christou@asteriacove.example',
    role: 'General manager',
    status: 'active',
    lastActive: 'team.activeYesterday',
  },
  {
    id: 'sofia',
    name: 'Sofia Nikolaou',
    email: 'sofia.nikolaou@asteriacove.example',
    role: 'Revenue manager',
    status: 'active',
    lastActive: 'team.active2DaysAgo',
  },
  {
    id: 'marios',
    name: 'Marios Georgiou',
    email: 'front.desk@asteriacove.example',
    role: 'Front desk',
    status: 'active',
    lastActive: 'team.active3HoursAgo',
  },
  {
    id: 'katerina',
    name: 'Katerina Ioannou',
    email: 'katerina.ioannou@asteriacove.example',
    role: 'Content editor',
    status: 'invited',
    lastActive: 'team.notSignedIn',
  },
  {
    id: 'housekeeper-demo',
    name: 'Nina Petrou',
    email: 'housekeeper@asteriacove.example',
    role: 'Housekeeper',
    status: 'active',
    lastActive: 'team.notSignedIn',
  },
  {
    id: 'hotelier-demo',
    name: 'Alexia Georgiou',
    email: 'hotelier@asteriacove.example',
    role: 'Hotelier',
    status: 'active',
    lastActive: 'team.notSignedIn',
    hotelIds: ['hotel_asteria'],
  },
];

/** Case and surrounding whitespace never decide whether an address is on the team. */
export function findMemberByEmail(email: string): TeamMember | null {
  const wanted = email.trim().toLowerCase();
  return demoMembers.find((member) => member.email.toLowerCase() === wanted) ?? null;
}

export function findMemberById(id: string): TeamMember | null {
  return demoMembers.find((member) => member.id === id) ?? null;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s.@_-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/**
 * What each built-in role can do. A custom role made from
 * `/admin/settings/team` carries its own `permissions` array instead of a
 * row here — `team-service.ts`'s `TeamService.listRoles` is what merges the
 * two into one list, and the only thing `requirePermission` ever consults.
 * A role not listed for a permission is refused it — `hasPermission`
 * defaults to `false`, not silently to `true`.
 */
export const permissions: { key: TeamPermissionKey; allowed: BuiltinTeamRole[] }[] = [
  {
    key: 'team.permViewBookings',
    allowed: ['Owner', 'General manager', 'Revenue manager', 'Front desk'],
  },
  { key: 'team.permCancelBookings', allowed: ['Owner', 'General manager', 'Front desk'] },
  { key: 'team.permEditRates', allowed: ['Owner', 'General manager', 'Revenue manager'] },
  { key: 'team.permEditContent', allowed: ['Owner', 'General manager', 'Content editor'] },
  { key: 'team.permManageMedia', allowed: ['Owner', 'General manager', 'Content editor'] },
  { key: 'team.permBrandDomain', allowed: ['Owner', 'General manager'] },
  { key: 'team.permTeamRoles', allowed: ['Owner'] },
  { key: 'team.permIntegrations', allowed: ['Owner', 'General manager'] },
  { key: 'team.permHousekeeping', allowed: ['Owner', 'General manager', 'Front desk', 'Housekeeper', 'Hotelier'] },
];

/** Built-in roles only — a custom role's own `permissions` array answers this directly, see `TeamService.hasPermission`. */
export function hasBuiltinPermission(role: BuiltinTeamRole, key: TeamPermissionKey): boolean {
  return permissions.find((permission) => permission.key === key)?.allowed.includes(role) ?? false;
}

/** The dictionary key for a translated built-in role — `null` when it displays its stored name. */
export function builtinRoleKey(role: TeamRole): `role.${'owner' | 'generalManager' | 'revenueManager' | 'frontDesk' | 'contentEditor'}` | null {
  switch (role as BuiltinTeamRole) {
    case 'Owner':
      return 'role.owner';
    case 'General manager':
      return 'role.generalManager';
    case 'Revenue manager':
      return 'role.revenueManager';
    case 'Front desk':
      return 'role.frontDesk';
    case 'Content editor':
      return 'role.contentEditor';
    default:
      return null;
  }
}
