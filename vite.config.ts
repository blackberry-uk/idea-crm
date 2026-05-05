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
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
