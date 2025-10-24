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

// Also patch XMLHttpRequest.open so legacy XHR usages (e.g. file uploads) that call
// `xhr.open(method, '/api/...')` get rewritten to the backend URL in production.
(function patchXHR() {
  if (typeof window === 'undefined' || typeof window.XMLHttpRequest === 'undefined') return;
  try {
    const XHR = window.XMLHttpRequest;
    const originalOpen = XHR.prototype.open;
    XHR.prototype.open = function(method, url) {
      try {
        if (typeof url === 'string' && url.startsWith('/api/')) {
          const absolute = `${config.backendUrl}${url}`;
          return originalOpen.apply(this, [method, absolute, ...Array.prototype.slice.call(arguments, 2)]);
        }
      } catch (e) { /* ignore and fall back */ }
      return originalOpen.apply(this, arguments);
    };
  } catch (e) { /* ignore patch failure */ }
})();
