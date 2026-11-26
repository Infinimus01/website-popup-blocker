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
| `sw.js` | Service Worker — intercepts navigation, survives refresh |

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
| Back button | ✅ Yes — requires 100 presses |
| Browser address bar | ✅ Yes — hidden in fullscreen |
| Page refresh | ✅ Yes — Service Worker redirects back |
| Close tab + reopen | ✅ Yes — Service Worker persists |
| Swipe gestures | ✅ Yes |
| Pinch zoom | ✅ Yes |
| Keyboard shortcuts (Ctrl+W etc.) | ✅ Yes |
| Long-press / right-click menu | ✅ Yes |
| Screen auto-lock | ✅ Yes — Wake Lock keeps screen on |
| Browser DevTools DOM editing | ✅ Yes — self-heals in <1 second |
| **Home button** | ❌ No — Android OS level |
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

1. **History stack stuffing** — 100 fake history entries refilled on every Back press
2. **Fullscreen API** — hides all browser chrome
3. **Fullscreen heartbeat** — re-enters fullscreen every 2.5 seconds
4. **Keyboard shortcut blocking** — Ctrl+W, Ctrl+T, F5, Alt+F4 etc.
5. **Touch gesture blocking** — all swipe gestures disabled
6. **beforeunload dialog** — "Leave site?" confirmation
7. **Visibility + focus re-lock** — fullscreen re-entered when tab regains focus
8. **Context menu blocker** — no long-press menu
9. **Selection & drag blocker** — no text copy or element drag
10. **Screen orientation lock** — forced portrait
11. **Wake Lock API** — screen stays on
12. **5 stacked popup layers** — removing one leaves 4 more
13. **MutationObserver self-healing** — detects and re-adds deleted popup
14. **DevTools detection** — reloads page if DevTools is opened
15. **Service Worker** — intercepts all navigation, survives page refresh
