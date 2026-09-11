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
