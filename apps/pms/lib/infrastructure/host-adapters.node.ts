import { createBlobBucket } from './blob-r2';
import { createLibsqlD1 } from './libsql-d1';
import { createPrivateBlobBucket } from './private-blob-bucket';

/**
 * What `#host-adapters` resolves to in the Vercel build (`vite.config.ts`
 * aliases it here when `NITRO_PRESET=vercel` or `VERCEL=1`): a Turso
 * (libSQL) database behind D1's shape and a Vercel Blob bucket behind R2's,
 * each built once per process from the project's environment variables.
 * `cloudflare-env.ts` asks for these only when `env` carries no real
 * binding, so the accessors above it never know which host they are on.
 */
let libsql: { url: string; db: D1Database } | null = null;
let blob: R2Bucket | null = null;

function variable(name: string): string | null {
  const value = process.env[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function hostDatabase(): D1Database | null {
  const url = variable('TURSO_DATABASE_URL');
  if (!url) return null;
  // One client per URL for the life of the process: a libSQL client holds its connection.
  if (!libsql || libsql.url !== url) libsql = { url, db: createLibsqlD1(url, variable('TURSO_AUTH_TOKEN') ?? undefined) };
  return libsql.db;
}

export function hostBucket(): R2Bucket | null {
  if (!variable('BLOB_READ_WRITE_TOKEN')) return null;
  blob ??= createBlobBucket();
  return blob;
}

export function hostPrivateDocumentBucket(): R2Bucket | null {
  const token = variable('PRIVATE_DOCUMENTS_BLOB_READ_WRITE_TOKEN');
  return token ? createPrivateBlobBucket(token) : null;
}
