/**
 * What `cloudflare:workers` resolves to when the app is built for a Node
 * host (`vite.config.vercel.ts` aliases the module here): the same `env`
 * export, backed by `process.env`. There are no D1 or R2 bindings in it —
 * `cloudflare-env.ts` sees that and reaches for the libSQL and Blob
 * adapters instead, keyed by `TURSO_DATABASE_URL` and
 * `BLOB_READ_WRITE_TOKEN`.
 */
export const env: Record<string, string | undefined> = process.env;
