import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const devPort = Number(env.VITE_DEV_PORT || 3000);
    const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:3001';
    return {
      server: {
        port: devPort,
        host: '0.0.0.0',
        proxy: {
            '/api': backendUrl,
        },
      },

      plugins: [react()],
      // NOTE: GEMINI_API_KEY is intentionally NOT injected into the client bundle.
      // All Gemini calls go through the backend (server.ts → /api/ideas/:id/counsel),
      // so the key never reaches the browser. Do not add it to `define`.
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
