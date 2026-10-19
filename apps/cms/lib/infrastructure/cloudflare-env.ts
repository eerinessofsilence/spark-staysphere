import { env } from 'cloudflare:workers';

function variable(name: string): string | null {
  const value = (env as unknown as Record<string, unknown>)[name] ?? process.env[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
export function getDemoDatabase(): D1Database | null {
  const db = (env as unknown as { DB?: D1Database }).DB;
  return db && typeof db.prepare === 'function' ? db : null;
}
export function getMediaBucket(): R2Bucket | null {
  const bucket = (env as unknown as { MEDIA?: R2Bucket }).MEDIA;
  return bucket && typeof bucket.put === 'function' ? bucket : null;
}
export function getOpenAiKey() { return variable('OPENAI_API_KEY'); }
export function getAdminAuthEnv() {
  return { password: variable('ADMIN_PASSWORD'), editorPassword: variable('EDITOR_PASSWORD'), sessionSecret: variable('ADMIN_SESSION_SECRET') };
}
export function getGuestAppUrl(path = '/') {
  const origin = variable('GUEST_APP_URL') ?? (process.env.NODE_ENV !== 'production' ? 'http://localhost:3100' : null);
  if (!origin) return null;
  try { const url = new URL(path, origin); return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null; } catch { return null; }
}
