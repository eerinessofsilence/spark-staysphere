import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Nested HTML entries keep clean URLs on any static host.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (mode === 'production' && (!(env.VITE_CMS_URL || process.env.VITE_CMS_URL) || !(env.VITE_GUEST_URL || process.env.VITE_GUEST_URL))) {
    throw new Error('Set VITE_CMS_URL and VITE_GUEST_URL before building the Product Site.');
  }
  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5273, strictPort: true },
    build: {
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL('./index.html', import.meta.url)),
          pricing: fileURLToPath(new URL('./pricing/index.html', import.meta.url)),
          modules: fileURLToPath(new URL('./pricing/modules/index.html', import.meta.url)),
        },
      },
    },
  };
})
