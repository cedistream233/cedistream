import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

import http from 'http';

async function pickBackendTarget() {
  const candidates = [];
  if (process.env.VITE_BACKEND_URL) candidates.push(process.env.VITE_BACKEND_URL);
  candidates.push('http://localhost:5000', 'http://localhost:5001', 'http://localhost:5002', 'http://localhost:5003');

  const tryHealth = (base) => new Promise((resolve) => {
    try {
      const url = new URL('/api/health', base);
      const req = http.get(url, { timeout: 600 }, (res) => {
        // any 2xx is ok
        resolve(res.statusCode && res.statusCode >= 200 && res.statusCode < 300 ? base : null);
        res.resume();
      });
      req.on('timeout', () => { req.destroy(new Error('timeout')); resolve(null); });
      req.on('error', () => resolve(null));
    } catch {
      resolve(null);
    }
  });

  for (const c of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await tryHealth(c);
    if (ok) return ok;
  }
  // fallback to default even if not reachable; user can start backend
  return process.env.VITE_BACKEND_URL || 'http://localhost:5000';
}

export default defineConfig(async () => {
  const target = await pickBackendTarget();
  return {
    plugins: [react()],
    server: {
      port: 3000,
      strictPort: true,
      host: true,
      proxy: {
        '/api': target,
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
  };
});
