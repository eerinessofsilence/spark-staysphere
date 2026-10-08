import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Nested HTML entries keep clean URLs on any static host.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (mode === 'production' && !(env.VITE_PMS_URL || process.env.VITE_PMS_URL)) {
    throw new Error('Set VITE_PMS_URL to the deployed PMS origin before building the Site.');
  }
  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173, strictPort: true },
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
