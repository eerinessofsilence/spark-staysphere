/**
 * What `#host-adapters` resolves to in the Cloudflare build (the default —
 * see `vite.config.ts` and `tsconfig.json`'s `paths`): nothing. D1 and R2
 * arrive as bindings on `env`, so there is no database or bucket to
 * construct here, and neither `@libsql/client` nor `@vercel/blob` — Node
 * packages workerd cannot load — ever enters the Worker bundle. The Node
 * counterpart is `host-adapters.node.ts`.
 */
export function hostDatabase(): D1Database | null {
  return null;
}

export function hostBucket(): R2Bucket | null {
  return null;
}

export function hostPrivateDocumentBucket(): R2Bucket | null { return null; }
