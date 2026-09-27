import { fileURLToPath } from 'node:url';
import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import hostingConfig from './.openai/hosting.json';

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  '00000000-0000-4000-8000-000000000000';

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

const localBindingConfig = {
  main: './worker.ts',
  triggers: { crons: ['*/10 * * * *'] },
  compatibility_flags: ['nodejs_compat'],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: 'site-creator-d1',
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        { binding: 'PRIVATE_DOCUMENTS', bucket_name: 'pms-private-documents' },
        {
          binding: r2,
          bucket_name: 'site-creator-r2',
        },
      ]
    : [],
};

/**
 * Which host this build is for. Cloudflare Workers is the default and the
 * one with native bindings; a Vercel build (`npm run build:vercel`, or any
 * build Vercel itself runs — it sets `VERCEL=1`) swaps the Cloudflare plugin
 * for Nitro's Vercel preset and points the one `cloudflare:workers` import
 * at a `process.env` shim, so `lib/infrastructure/cloudflare-env.ts` reaches
 * for Turso and Vercel Blob instead of D1 and R2. See TECH.md's "Hosting".
 */
const forVercel = process.env.NITRO_PRESET === 'vercel' || process.env.VERCEL === '1';
const here = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig(async () => {
  if (forVercel) {
    const { nitro } = await import('nitro/vite');
    return {
      css: { postcss: { plugins: [tailwindcss()] } },
      optimizeDeps: { include: ['@react-pdf/renderer'] },
      resolve: {
        alias: [
          { find: 'cloudflare:workers', replacement: here('./lib/infrastructure/node-workers-shim.ts') },
          { find: '#host-adapters', replacement: here('./lib/infrastructure/host-adapters.node.ts') },
          // Nitro's resolver leaves postcss-import unable to find these bare
          // stylesheet specifiers (it opens `<root>/tailwindcss`), so they are
          // pointed at the packages' own CSS entries; the Cloudflare build
          // resolves them by itself and needs none of this.
          { find: /^tailwindcss$/, replacement: here('./node_modules/tailwindcss/index.css') },
          { find: /^tw-animate-css$/, replacement: here('./node_modules/tw-animate-css/dist/tw-animate.css') },
          { find: /^shadcn\/tailwind\.css$/, replacement: here('./node_modules/shadcn/dist/tailwind.css') },
        ],
      },
      plugins: [
        vinext(),
        // `resolve.alias` above only reaches the Vite-built RSC/page graph —
        // Nitro bundles `app/api/**/route.ts` handlers through its own,
        // separate resolution pass and needs the same swap passed to it
        // directly. Without this, those route handlers silently got the
        // Cloudflare stub even on Vercel with every env var set correctly,
        // so `hostDatabase()`/`hostBucket()` were always `null` there and
        // Turso/Vercel Blob were never actually used — confirmed by bundling
        // and inspecting the built output with and without this alias.
        nitro({
          alias: {
            '#host-adapters': here('./lib/infrastructure/host-adapters.node.ts'),
            'cloudflare:workers': here('./lib/infrastructure/node-workers-shim.ts'),
          },
        }),
      ],
    };
  }

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    optimizeDeps: { include: ['@react-pdf/renderer'] },
    // The Node-host adapters (libSQL, Vercel Blob) never enter the Worker bundle.
    resolve: { alias: [{ find: '#host-adapters', replacement: here('./lib/infrastructure/host-adapters.cloudflare.ts') }] },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
