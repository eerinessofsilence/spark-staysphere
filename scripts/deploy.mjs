#!/usr/bin/env node
/**
 * `npm run build` writes `dist/server/wrangler.json` with the `@openai/sites-vite-plugin`
 * scaffold's placeholder D1/R2 bindings (`site-creator-d1`/`00000000-...`, `site-creator-r2`) —
 * meant to be swapped for this project's own resources by whichever platform deploys it. This
 * script is that swap for a plain `wrangler deploy`: find-or-create the D1 database and R2 bucket
 * under the authenticated Cloudflare account, patch them into the generated config, then deploy.
 *
 * R2 has to be enabled once, by hand, in the Cloudflare Dashboard (a billing opt-in `wrangler`
 * cannot do on someone's behalf) — until then this deploys without the MEDIA binding, so
 * everything works except spinner-frame uploads (`/admin/content/spinner/frames`).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const WRANGLER_CONFIG = 'dist/server/wrangler.json';
const D1_NAME = 'spark-staysphere-db';
const R2_NAME = 'spark-staysphere-media';
const PRIVATE_DOCUMENTS_R2_NAME = 'spark-staysphere-private-documents';

function wrangler(args) {
  return execFileSync('npx', ['wrangler', ...args], { encoding: 'utf8' });
}

console.log('Building...');
execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });

const config = JSON.parse(readFileSync(WRANGLER_CONFIG, 'utf8'));

const databases = JSON.parse(wrangler(['d1', 'list', '--json']));
let db = databases.find((entry) => entry.name === D1_NAME);
if (!db) {
  console.log(`Creating D1 database "${D1_NAME}"...`);
  db = JSON.parse(wrangler(['d1', 'create', D1_NAME, '--json']));
}
config.d1_databases = [{ binding: 'DB', database_name: D1_NAME, database_id: db.uuid ?? db.database_id }];

try {
  // `r2 bucket list` has no --json; its plain output is one `name:` line per bucket.
  const buckets = wrangler(['r2', 'bucket', 'list'])
    .split('\n')
    .map((line) => line.match(/^name:\s+(\S+)/)?.[1])
    .filter(Boolean);
  if (!buckets.includes(R2_NAME)) {
    console.log(`Creating R2 bucket "${R2_NAME}"...`);
    wrangler(['r2', 'bucket', 'create', R2_NAME]);
  }
  if (!buckets.includes(PRIVATE_DOCUMENTS_R2_NAME)) {
    console.log('Creating private document bucket...');
    wrangler(['r2', 'bucket', 'create', PRIVATE_DOCUMENTS_R2_NAME]);
  }
  config.r2_buckets = [
    { binding: 'MEDIA', bucket_name: R2_NAME },
    { binding: 'PRIVATE_DOCUMENTS', bucket_name: PRIVATE_DOCUMENTS_R2_NAME },
  ];
} catch {
  console.warn(
    `R2 isn't enabled on this Cloudflare account yet (Dashboard → R2 → Enable) — deploying ` +
      `without the MEDIA binding. Spinner-frame uploads will stay unavailable until R2 is enabled ` +
      `and this script is run again.`,
  );
  config.r2_buckets = [];
}

writeFileSync(WRANGLER_CONFIG, JSON.stringify(config, null, 2));

console.log('Deploying...');
execFileSync('npx', ['wrangler', 'deploy', '--config', WRANGLER_CONFIG], { stdio: 'inherit' });
