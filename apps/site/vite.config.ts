import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Nested HTML entries keep clean URLs on any static host.
export default defineConfig({
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
})
