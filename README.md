# Website Popup Blocker

A maximum-strength browser-level popup that locks visitors to a warning screen.  
Works on **all mobile and desktop browsers** — no app installation required.

---

## How It Works

When a user visits your website, they see a full-screen warning popup that:

- Blocks the **Back button** (requires 100 presses to get through)
- Hides the browser's **address bar and navigation** (Fullscreen API)
- **Blocks all swipe gestures** (swipe-back, pull-to-refresh, pinch zoom)
- **Keeps the screen on** so it doesn't auto-sleep (Wake Lock API)
- **Survives page refresh** via Service Worker
- **Self-heals** if removed via browser DevTools (MutationObserver)
- **Detects DevTools** and reloads the page to clear any edits
- Stacks **5 overlapping popup layers** — removing one leaves 4 more

---

## Files

| File | Purpose |
|---|---|
| `popup.html` | The main warning page — put this on your web server |
| `sw.js` | Service Worker — intercepts navigation, handles notifications |
| `manifest.json` | PWA manifest — enables standalone app mode, no browser chrome |

---

## How to Customise the Message

Open `popup.html` and find these two sections:

```html
<!-- ↓↓ CHANGE TITLE HERE ↓↓ -->
<div class="title">This Site Is Blocked</div>

<!-- ↓↓ CHANGE MESSAGE HERE ↓↓ -->
<div class="message">
  This website is not allowed on this device.<br><br>
  You cannot continue from here.<br><br>
  <strong style="color:#ff3b3b;">Restart your phone to exit.</strong>
</div>
```

Change the text to anything you want. Use `<br>` for a new line.

To change the background colour, find:
```css
background: #0a0a0a;
```
Replace `#0a0a0a` with any colour code.

---

## How to Add to Your Website

### Option A — Replace your entire website with the popup

1. Upload `popup.html` to your web server **root** as `index.html`
2. Upload `sw.js` to your web server **root**
3. Done — anyone visiting your domain sees the popup

### Option B — Trigger the popup on a specific page

1. Upload both files to your server root
2. Add this redirect to any page you want to trigger it:
   ```html
   <script>window.location.href = '/popup.html';</script>
   ```
3. Or redirect from your backend (PHP, Node, etc.):
   ```php
   header('Location: /popup.html');
   ```

### Option C — Embed in an existing page

Copy the entire `<style>` block, all HTML inside `<body>`, and the entire `<script>` block into your existing page. Also upload `sw.js` to the server root.

---

## How to Upload to Your Server

### Using cPanel (most web hosting)
1. Log into your hosting control panel
2. Open **File Manager**
3. Navigate to `public_html` (your website root)
4. Click **Upload**
5. Upload `popup.html` and `sw.js`
6. If replacing your homepage, rename `popup.html` to `index.html`

### Using FTP (FileZilla etc.)
1. Connect to your server via FTP
2. Navigate to `public_html` or `www`
3. Drag and drop both files
4. Done

### Using SSH
```bash
scp popup.html sw.js user@yourserver.com:/var/www/html/
```

---

## Important: Service Worker Requirement

The Service Worker (`sw.js`) **must be served from the same domain** as `popup.html`.  
Both files must be in the **root** of your website (e.g. `https://yoursite.com/sw.js`).

If your site uses HTTPS (recommended), the Service Worker works automatically.  
If your site uses HTTP only, the Service Worker only works on `localhost`.

---

## What This Blocks vs. What It Cannot Block

| Escape method | Blocked? |
|---|---|
| Back button | ✅ Yes — 100 fake history entries, shake + vibration |
| Browser address bar | ✅ Yes — hidden in fullscreen |
| Page refresh | ✅ Yes — Service Worker redirects back |
| Close tab + reopen | ✅ Yes — Service Worker persists |
| Swipe gestures | ✅ Yes |
| Pinch zoom | ✅ Yes |
| Keyboard shortcuts (Ctrl+W, Escape etc.) | ✅ Yes |
| Long-press / right-click menu | ✅ Yes |
| Screen auto-lock | ✅ Yes — Wake Lock keeps screen on |
| Browser DevTools DOM editing | ✅ Yes — self-heals in <100ms, full subtree watch |
| DevTools open | ✅ Yes — page reloads, clearing any edits |
| Iframe embedding | ✅ Yes — breaks out to top-level window |
| Tab discard / browser freeze | ✅ Yes — reloads on resume |
| Android keyboard opening | ✅ Yes — popup resizes to fill exact viewport |
| **Home button** | ⚠️ Partial — 2 new popup tabs spawn automatically |
| **Recent apps** | ❌ No — Android OS level |
| **Phone restart** | ❌ No |

> For Home button and Recent apps blocking, use the **Site Blocker APK** alongside this.

---

## How to Share This With Someone

**Share the website link:**  
Just send the URL of your website. Anyone who opens it immediately sees the popup.

**Share the files directly:**  
Send `popup.html` and `sw.js` to anyone who wants to host it on their own server.

---

## Removing the Service Worker (Reset)

If you need to clear the Service Worker from a browser:

**On Chrome / Samsung Internet:**
1. Open `chrome://settings/siteData` or **Settings → Privacy → Clear browsing data**
2. Select **Cookies and site data**
3. Clear data for the specific domain

**Via JavaScript (if you have page access):**
```javascript
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(reg => reg.unregister());
});
```

---

## Techniques Used

1. **Iframe breakout** — if page is embedded in an iframe, forces top-level navigation to this page
2. **History stack stuffing** — 100 fake entries refilled on every Back press; shake + vibrate feedback
3. **Fullscreen API** — hides all browser chrome; re-enters on every exit
4. **Fullscreen heartbeat** — re-enters fullscreen every 2 seconds if not already in it
5. **Escape key handler** — blocks Escape, Ctrl+W, Ctrl+T, F5, Alt+F4; re-enters fullscreen after Escape
6. **Touch gesture blocking** — swipe-back, pull-to-refresh, pinch zoom all disabled
7. **beforeunload dialog** — "Leave site?" confirmation
8. **pagehide / freeze recovery** — detects tab discard or browser freeze; forces reload on resume
9. **Visibility + focus re-lock** — fullscreen re-entered on tab focus, pageshow, resume
10. **Context menu blocker** — no long-press / right-click menu
11. **Selection, drag, copy & cut blocker** — no text copy or element drag
12. **Screen orientation lock** — forced portrait
13. **Wake Lock API** — screen stays on, prevents auto-sleep
14. **ResizeObserver + VisualViewport** — corrects popup height when Android keyboard opens/closes
15. **Vibration on Back press** — haptic feedback (Android)
16. **5 stacked popup layers** — removing one leaves 4 more
17. **MutationObserver self-healing** — watches full DOM subtree; restores deleted or hidden layers instantly
18. **DevTools detection** — two methods (debugger timing + viewport ratio); reloads page on detection
19. **BroadcastChannel tab network** — all open popup tabs are connected; when any tab closes, every other tab instantly spawns 2 replacements
20. **Touch-triggered tab spawn** — every tap on the popup opens a background copy (from user gesture, bypasses popup blockers); rate-limited to 1 per 15s
21. **Notification trap** — on first tap, requests notification permission; if granted, shows a persistent "Site Blocked" notification that stays in notification shade even when browser is fully closed; tapping it reopens the browser to the popup
22. **PWA manifest** — makes the site installable as a standalone app with zero browser chrome (no address bar, no back button UI)
23. **Tab spawning on Home press** — when user presses Home or switches app, 2 new popup tabs open automatically
24. **Service Worker** — intercepts all navigation, 3-tier fallback (cache → network → inline HTML), handles notification tap to reopen popup
