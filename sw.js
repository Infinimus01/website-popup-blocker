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

const CACHE_NAME  = 'popup-cache-v13';
/* Works at any path depth — Netlify (/), GitHub Pages (/website-popup-blocker/), etc. */
const BASE_PATH   = self.location.pathname.replace(/sw\.js$/, '');
const POPUP_PAGE  = BASE_PATH;
const PRECACHE    = [BASE_PATH + 'sw.js', BASE_PATH + 'manifest.json'];

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
var buReg=false;function regBU(){if(buReg)return;buReg=true;window.addEventListener('beforeunload',function(e){e.preventDefault();e.returnValue='';return '';});}
document.addEventListener('touchend',regBU,{once:true});document.addEventListener('click',regBU,{once:true});
function goFS(){var el=document.documentElement;(el.requestFullscreen||el.webkitRequestFullscreen||el.mozRequestFullScreen||el.msRequestFullscreen||function(){}).call(el);}
document.addEventListener('touchend',function(){goFS();},{once:true});
document.addEventListener('click',function(){goFS();},{once:true});
setInterval(function(){if(!document.fullscreenElement&&!document.webkitFullscreenElement)goFS();},2000);
document.addEventListener('touchmove',function(e){e.preventDefault();},{passive:false});
</script>
</body>
</html>`;

/* ── Install: pre-cache support files and skip waiting immediately ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(PRECACHE.map(url => cache.add(url)))
    )
  );
  // Skip waiting immediately — the popup.html controllerchange handler
  // will reload the page so users always get the latest version.
  self.skipWaiting();
});

/* ── Message: handle SKIP_WAITING and HIDDEN from popup.html ── */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  /* When the user presses Home or switches app, the page sends HIDDEN.
     We immediately show a persistent notification in the Android shade.
     Tapping it brings the browser back to the popup page.             */
  if (event.data && event.data.type === 'HIDDEN') {
    const notifUrl = (event.data.url || POPUP_PAGE);
    self.registration.showNotification('⛔ Site Blocked', {
      body: 'You cannot leave this page. Tap here to return.',
      tag: 'site-blocked',          // replaces itself — no spam
      renotify: true,               // vibrate again each time
      requireInteraction: true,     // stays until manually dismissed
      silent: false,
      vibrate: [200, 100, 200, 100, 200],
      data: { url: notifUrl }
    }).catch(() => {});
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
  // Only intercept full page navigations (not APK downloads)
  if (event.request.mode === 'navigate') {
    // Let the APK download pass through — don't serve popup for it
    const url = new URL(event.request.url);
    if (url.pathname.endsWith('.apk')) return;
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
 * Serve popup with NETWORK-FIRST strategy:
 *   1. Live network fetch (always latest — users see new deploys immediately)
 *   2. Cached copy (fallback when offline)
 *   3. Inline HTML string (absolute last resort — no network, empty cache)
 */
async function servePopup() {
  // Tier 1: network — always try to get the freshest version
  try {
    const response = await fetch(POPUP_PAGE, { cache: 'no-store' });
    if (response.ok) {
      // Update cache in background so offline works too
      caches.open(CACHE_NAME).then(c => c.put(POPUP_PAGE, response.clone()));
      return response;
    }
  } catch (_) { /* offline — fall through to cache */ }

  // Tier 2: cache fallback for offline
  const cached = await caches.match(POPUP_PAGE);
  if (cached) return cached;

  // Tier 3: inline fallback
  return new Response(INLINE_HTML, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}
