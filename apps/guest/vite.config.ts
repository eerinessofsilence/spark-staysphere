import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';
  const { cloudflare } = await import('@cloudflare/vite-plugin');
  return {
    optimizeDeps: { include: ['@base-ui/react/select', '@base-ui/react/popover', '@base-ui/react/dialog', '@base-ui/react/slider'] },
    css: { postcss: { plugins: [tailwindcss()] } },
    server: { port: 3100, strictPort: true, watch: process.env.CODEX_SANDBOX === 'seatbelt' ? { useFsEvents: false, usePolling: true } : undefined },
    plugins: [vinext(), cloudflare({
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] }, inspectorPort: false, persistState: false,
      config: { name: 'staysphere-cms-guest', main: 'vinext/server/fetch-handler', compatibility_date: '2026-05-22', compatibility_flags: ['nodejs_compat'],
        vars: { CMS_API_URL: process.env.CMS_API_URL || 'http://localhost:3101' } },
    })],
  };
});
