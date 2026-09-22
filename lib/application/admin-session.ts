import { cookies } from 'next/headers';
import { adminAuthConfig, teamService } from './container';
import { isAdminInterest, type AdminInterest } from './admin-interests';
import type { TeamMember, TeamPermissionKey } from './team-directory';

/**
 * Who is signed in to the back office, and what they said they are here
 * for. One cookie, scoped to `/admin` like the property and language ones,
 * carrying a small JSON payload and an HMAC over it — so a browser can read
 * its own session but cannot mint or edit one. There is no session store:
 * signing out is clearing the cookie, and the payload is everything the
 * shell needs (the member, the interests picked in the second step of
 * sign-in, when it expires), so no request has to look anything up.
 *
 * Read by `app/admin/layout.tsx` (the gate in front of every screen), by
 * `requireAdminSession`/`requirePermission` at the top of every admin server
 * action (the gate in front of every write, since an action can be called
 * without ever rendering the layout), and through the latter by
 * `ContentService`'s `authorize` — the choke point CLAUDE.md always said auth
 * would wire into, handed in by the container, now parameterized by which of
 * `team-directory.ts`'s permissions the mutator needs.
 */

export const ADMIN_SESSION_COOKIE = 'admin-session';

/** A working week — long enough not to sign a desk out mid-shift, short enough that a stale laptop expires. */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export { ADMIN_INTERESTS, INTEREST_ROUTES, isAdminInterest, type AdminInterest } from './admin-interests';

export interface AdminSession {
  memberId: string;
  /** Empty until the second sign-in step is done — or skipped, which also counts as done. */
  interests: AdminInterest[];
  onboarded: boolean;
  /** Unix seconds. */
  exp: number;
}

export class AdminAuthError extends Error {
  constructor() {
    super('Sign in to continue.');
    this.name = 'AdminAuthError';
  }
}

/**
 * Signed in, but the role isn't listed for this permission — distinct from
 * `AdminAuthError` ("no one is signed in") so a caller can tell "sign in
 * again" from "this account can't do that" apart. Named by string (`.name`)
 * rather than an `instanceof` export: `ContentService` catches this without
 * importing `admin-session.ts` at all, the same way it never imports the
 * session it's authorized through — see `container.ts`'s lazy authorizer.
 */
export class AdminPermissionError extends Error {
  constructor() {
    super("Your role doesn't include this.");
    this.name = 'AdminPermissionError';
  }
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
  try {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

/** Constant-time, so a forged signature does not leak how many leading characters it got right. */
function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function encodeSession(session: AdminSession): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify(session)));
  return `${payload}.${await hmac(adminAuthConfig().sessionSecret, payload)}`;
}

export async function decodeSession(token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  if (!sameString(signature, await hmac(adminAuthConfig().sessionSecret, payload))) return null;

  const bytes = fromBase64Url(payload);
  if (!bytes) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<AdminSession>;
    if (typeof parsed.memberId !== 'string' || typeof parsed.exp !== 'number') return null;
    if (parsed.exp * 1000 < Date.now()) return null;
    if (!(await teamService.findMemberById(parsed.memberId))) return null;
    return {
      memberId: parsed.memberId,
      interests: Array.isArray(parsed.interests) ? parsed.interests.filter(isAdminInterest) : [],
      onboarded: parsed.onboarded === true,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

/** The session behind the current request, or null — never throws, so a layout can redirect on it. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  return decodeSession(store.get(ADMIN_SESSION_COOKIE)?.value);
}

/** The signed-in member, for the shell and the account page. */
export async function getAdminMember(): Promise<TeamMember | null> {
  const session = await getAdminSession();
  return session ? teamService.findMemberById(session.memberId) : null;
}

/**
 * For server actions: the layout's redirect never protected these, since an
 * action can be posted to without a page ever rendering. Thrown, not
 * redirected — a form gets a failed submission, which its own error path
 * already knows how to show, rather than a navigation from inside a fetch.
 */
export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new AdminAuthError();
  return session;
}

/**
 * `requireAdminSession`, plus the signed-in member's role must be listed for
 * `key` — see `team-directory.ts`'s own doc comment on `hasPermission`.
 */
export async function requirePermission(key: TeamPermissionKey): Promise<AdminSession> {
  const session = await requireAdminSession();
  const member = await teamService.findMemberById(session.memberId);
  if (!member || !(await teamService.hasPermission(member.role, key))) throw new AdminPermissionError();
  return session;
}

export async function writeAdminSession(session: AdminSession): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE, await encodeSession(session), {
    path: '/admin',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearAdminSession(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE, '', { path: '/admin', httpOnly: true, sameSite: 'lax', maxAge: 0 });
}

/**
 * Step one of sign-in. A wrong address and a wrong password fail
 * identically, so the form cannot be used to find out which addresses are
 * on the team. The password is the one shared back-office password
 * (`ADMIN_PASSWORD`, or the demo one) — there are no per-member passwords
 * in this demo. The roster includes seeded members and accounts created by
 * the administrator; production still needs a per-user identity provider.
 */
export async function signIn(email: string, password: string): Promise<AdminSession | null> {
  const member = await teamService.findMemberByEmail(email);
  const config = adminAuthConfig();
  if (!member || !sameString(password, config.password)) return null;
  const session: AdminSession = {
    memberId: member.id,
    interests: [],
    onboarded: false,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  await writeAdminSession(session);
  return session;
}
