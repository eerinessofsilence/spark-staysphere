import { env } from 'cloudflare:workers';

/**
 * Resolved fresh on every call, never cached at module scope. The `env`
 * export only reflects real bindings once a request is being handled by
 * workerd, and this module is imported well before that happens.
 */
export function getDemoDatabase(): D1Database | null {
  return (env as Cloudflare.Env).DB ?? null;
}

/** Same call-time-resolution rule as `getDemoDatabase`. Never cache this at module scope. */
export function getOpenAiKey(): string | null {
  return (env as Cloudflare.Env).OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? null;
}

/** Same call-time-resolution rule as `getDemoDatabase`. Never cache this at module scope. */
export function getMediaBucket(): R2Bucket | null {
  return (env as Cloudflare.Env).MEDIA ?? null;
}

/**
 * Same call-time-resolution rule as `getDemoDatabase`. Never cache this at module scope.
 * Either value may be unset: `container.ts`'s `adminAuthConfig` applies the demo defaults
 * and says which of the two it did, so the sign-in page can show the demo credentials only
 * while they are the ones in force.
 */
export function getAdminAuthEnv(): { password: string | null; sessionSecret: string | null } {
  const bindings = env as Cloudflare.Env;
  return {
    password: bindings.ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? null,
    sessionSecret: bindings.ADMIN_SESSION_SECRET ?? process.env.ADMIN_SESSION_SECRET ?? null,
  };
}
