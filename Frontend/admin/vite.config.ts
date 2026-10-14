import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Shared code from the public site (palette); keeps both apps visually identical
      '@site': fileURLToPath(new URL('../website/src', import.meta.url)),
    },
  },
  server: {
    // The MEDIUM server (server/, port 3020) answers /api; same origin keeps the session cookie simple
    proxy: { '/api': 'http://localhost:3020' },
  },
  preview: {
    proxy: { '/api': 'http://localhost:3020' },
  },
});
