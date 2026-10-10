import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: Boolean(process.env.CODESPACES),
    hmr: process.env.CODESPACES
      ? { protocol: 'wss', clientPort: 443, host: `${process.env.CODESPACE_NAME}-5173.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}` }
      : true
  },
  preview: { host: true, port: 4173 },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          if (/node_modules\/(framer-motion|motion-dom|motion-utils)\//.test(id)) return 'movimiento';
          if (id.includes('node_modules/@supabase/')) return 'datos';
          return undefined;
        }
      }
    }
  }
});