/*
 * Service Worker — Navigation Interceptor
 *
 * This runs OUTSIDE the page, in the browser's background thread.
 * It intercepts every navigation request on this domain and
 * redirects it back to popup.html — even after page refresh.
 *
 * HOW IT WORKS:
 *   1. popup.html registers this service worker on first load
 *   2. After registration, every page load on this domain
 *      is intercepted here — before the browser even renders it
 *   3. All navigate requests are served popup.html instead
 *
 * RESULT:
 *   - Refresh the page → still shows popup
 *   - Type a new URL in the address bar → still shows popup
 *   - Close tab, open new tab to same domain → still shows popup
 *   - Only clearing browser data removes this worker
 */

const POPUP_PAGE = '/popup.html';
const CACHE_NAME = 'popup-cache-v1';

/* ── Install: cache the popup page immediately ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.add(POPUP_PAGE);
    })
  );
  self.skipWaiting(); // activate immediately, don't wait for old SW to die
});

/* ── Activate: take control of all open tabs instantly ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

/* ── Fetch: intercept every request ── */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only intercept navigation requests (page loads, not images/css/js)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(POPUP_PAGE).then((cached) => {
        // Serve cached popup.html for every page navigation
        if (cached) return cached;
        // Fallback: fetch popup.html from network
        return fetch(POPUP_PAGE);
      })
    );
    return;
  }

  // For all other requests (images, CSS, JS), pass through normally
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
