import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Separate from vite.config.ts on purpose: that config is async, loads the
 * Cloudflare Workers plugin, and reads `.openai/hosting.json` — none of
 * which a plain Node unit-test run needs or should depend on. This one is a
 * bare Node environment with the same `@/` path alias, for lib/domain and
 * lib/application tests that never touch lib/infrastructure/cloudflare-env.ts
 * (which imports `cloudflare:workers`, unavailable outside a Worker).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
