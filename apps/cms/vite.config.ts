import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';
  const { cloudflare } = await import('@cloudflare/vite-plugin');
  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    optimizeDeps: { include: ['@react-pdf/renderer', '@base-ui/react/menu', '@base-ui/react/select', '@base-ui/react/popover'] },
    server: { port: 3101, strictPort: true, watch: process.env.CODEX_SANDBOX === 'seatbelt' ? { useFsEvents: false, usePolling: true } : undefined },
    plugins: [vinext(), cloudflare({
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
      inspectorPort: false,
      persistState: true,
      config: {
        name: 'staysphere-cms',
        main: 'vinext/server/fetch-handler',
        compatibility_date: '2026-05-22',
        compatibility_flags: ['nodejs_compat'],
        d1_databases: [{ binding: 'DB', database_name: 'cms-content', database_id: '00000000-0000-4000-8000-000000000000' }],
        r2_buckets: [{ binding: 'MEDIA', bucket_name: 'cms-media' }],
        vars: { GUEST_APP_URL: process.env.GUEST_APP_URL || 'http://localhost:3100' },
      },
    })],
  };
});
