import { env } from 'cloudflare:workers';
import { hostBucket, hostDatabase, hostPrivateDocumentBucket } from '#host-adapters';

/**
 * Where the app's bindings come from, resolved fresh on every call and never
 * cached at module scope: on Workers the `env` export only reflects real
 * bindings once a request is being handled by workerd, and this module is
 * imported well before that happens.
 *
 * Two hosts share this file. On Cloudflare, `env` carries the D1 and R2
 * bindings themselves and `#host-adapters` is a stub. On a Node host
 * (Vercel — see `vite.config.ts`, which aliases `cloudflare:workers` to
 * `node-workers-shim.ts` and `#host-adapters` to `host-adapters.node.ts`),
 * `env` is `process.env`, there are no bindings, and the adapters hand back
 * a libSQL database and a Vercel Blob bucket behind D1's and R2's own
 * shapes — so nothing above this layer knows which host it is on. See
 * TECH.md's "Hosting".
 */
type Bindings = Cloudflare.Env & Record<string, string | undefined>;

function bindings(): Bindings {
  return env as unknown as Bindings;
}

function variable(name: string): string | null {
  const value = bindings()[name] ?? process.env[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function getDemoDatabase(): D1Database | null {
  const bound = bindings().DB;
  if (bound && typeof bound === 'object' && 'prepare' in bound) return bound;
  return hostDatabase();
}

/** Same call-time-resolution rule as `getDemoDatabase`. Never cache this at module scope. */
export function getOpenAiKey(): string | null {
  return variable('OPENAI_API_KEY');
}

/** Same call-time-resolution rule as `getDemoDatabase`. Never cache this at module scope. */
export function getMediaBucket(): R2Bucket | null {
  const bound = bindings().MEDIA;
  if (bound && typeof bound === 'object' && 'put' in bound) return bound;
  return hostBucket();
}

export function getPrivateDocumentBucket(): R2Bucket | null {
  const bound = (env as unknown as { PRIVATE_DOCUMENTS?: R2Bucket }).PRIVATE_DOCUMENTS;
  return bound && typeof bound === 'object' && 'put' in bound ? bound : hostPrivateDocumentBucket();
}

export function getCronSecret(): string | null { return variable('CRON_SECRET'); }

/** Resolved at call time like the rest; `null` keeps the inbound-email webhook closed. */
export function getInboundEmailSecret(): string | null {
  return variable('INBOUND_EMAIL_SECRET');
}

/** Same call-time-resolution rule as `getOpenAiKey`. Unset keeps outbound email logged, not sent. */
export function getResendApiKey(): string | null {
  return variable('RESEND_API_KEY');
}

/** The address automation and desk-reply emails send from. Resend's own shared sandbox address until a hotel's domain is verified with them. */
export function getResendFromEmail(): string {
  return variable('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev';
}

/**
 * Same call-time-resolution rule as `getDemoDatabase`. Never cache this at module scope.
 * Either value may be unset: `container.ts`'s `adminAuthConfig` applies the demo defaults
 * and says which of the two it did, so the sign-in page can show the demo credentials only
 * while they are the ones in force.
 */
export function getAdminAuthEnv(): { password: string | null; sessionSecret: string | null } {
  return { password: variable('ADMIN_PASSWORD'), sessionSecret: variable('ADMIN_SESSION_SECRET') };
}
