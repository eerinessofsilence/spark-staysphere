import { cookies } from 'next/headers';
import { adminAuthConfig } from './container';

export const ADMIN_SESSION_COOKIE = 'cms-session';
export type AdminSession = { role: 'admin' | 'editor'; exp: number };
export class AdminAuthError extends Error { constructor() { super('Sign in to edit hotel content.'); this.name = 'AdminAuthError'; } }
export class AdminPermissionError extends Error { constructor() { super('Your role cannot perform this action.'); this.name = 'AdminPermissionError'; } }

async function signature(payload: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(adminAuthConfig().sessionSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export function sameString(a: string, b: string) {
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}
export async function writeAdminSession(role: AdminSession['role']) {
  const payload = `${role}.${Math.floor(Date.now() / 1000) + 8 * 60 * 60}`;
  (await cookies()).set(ADMIN_SESSION_COOKIE, `${payload}.${await signature(payload)}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/admin', maxAge: 8 * 60 * 60 });
}
export async function getAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;
  const [role, expiry, signed, extra] = token.split('.');
  if (extra || (role !== 'admin' && role !== 'editor') || !expiry || !/^\d+$/.test(expiry) || Number(expiry) <= Date.now() / 1000 || !signed) return null;
  return sameString(signed, await signature(`${role}.${expiry}`)) ? { role, exp: Number(expiry) } : null;
}
export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session) throw new AdminAuthError();
  return session;
}
export async function requirePermission(permission: string) {
  const session = await requireAdminSession();
  if (session.role === 'editor' && !['team.permEditContent', 'team.permEditRates'].includes(permission)) throw new AdminPermissionError();
  return session;
}
