import { config } from './config.js';

// Patch global fetch to prefix relative /api requests with backendUrl in production
// This avoids Netlify trying to serve /api/* from the static site (404)
(function patchGlobalFetch() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input, init) => {
    try {
      const isString = typeof input === 'string';
      const url = isString ? input : (input?.url || '');
      // Only rewrite relative /api/* URLs
      if (url && url.startsWith('/api/')) {
        const absolute = `${config.backendUrl}${url}`;
        return originalFetch(absolute, init);
      }
    } catch {}
    return originalFetch(input, init);
  };
})();
