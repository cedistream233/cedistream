import { config } from './config.js';

// Patch global fetch to prefix relative /api requests with backendUrl in production
// This avoids the static site host serving /api/* directly (404) by rewriting
// client-side calls to the API to the backend URL.
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
