/*
 * The service worker (PRD §4.27, §4.56).
 *
 * Network first, always: whenever the server answers, its answer is what you
 * see, so a cached note can never stand in for a newer one. Copies are kept
 * only so the installed app can open, and show what this device last saw,
 * when there is no connection at all. Editing such a copy goes through the
 * device outbox (§4.55) with the version it was built on, so a clash becomes
 * a conflicted copy, never an overwrite.
 *
 * What is kept:
 *  - STATIC: the build's hashed files under /_next/static (they never change)
 *    and icons — cache first.
 *  - DATA: the signed-in page "/", the full note list, notes you opened, and
 *    images you viewed. Cleared on sign-out and whenever the sign-in page
 *    loads (a session ended elsewhere), so notes do not stay on a device
 *    that is no longer signed in. Searches are never kept.
 */

const OFFLINE_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>mdNotes — offline</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center;
         background: #11161d; color: #c8d3df; font: 16px/1.5 system-ui, sans-serif; }
  main { max-width: 22rem; padding: 2rem; text-align: center; }
  h1 { color: #6ee7a8; font-size: 1.25rem; margin: 0 0 .5rem; }
  button { margin-top: 1.25rem; padding: .7rem 1.2rem; border: 0; border-radius: .6rem;
           background: #6ee7a8; color: #10151b; font: inherit; font-weight: 600; }
</style></head>
<body><main>
  <h1>You’re offline</h1>
  <p>This page has not been opened on this device yet. Open mdNotes once while online and it will open offline next time. Nothing has been lost.</p>
  <button onclick="location.reload()">Try again</button>
</main></body></html>`;

const STATIC = "mdnotes-static-v1";
const DATA = "mdnotes-data-v1";
const STATIC_LIMIT = 400;

const offlinePage = () =>
  new Response(OFFLINE_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC, DATA]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);

self.addEventListener("message", (event) => {
  if (event.data === "clear-data") event.waitUntil(caches.delete(DATA));
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, key) {
  const cache = await caches.open(DATA);
  try {
    const response = await fetch(request);
    // Only a real, signed-in answer is kept: not an error, not a redirect,
    // and never a locked note (PRD §4.69) — any copy already kept goes.
    if (response.headers.get("x-ursa-sensitive")) await cache.delete(key);
    else if (response.ok && !response.redirected) await cache.put(key, response.clone());
    return response;
  } catch (error) {
    const hit = await cache.match(key);
    if (hit) return hit;
    throw error;
  }
}

/** The files a page needs, so an offline reload can run it (first install included). */
async function precacheAssets(html) {
  const urls = new Set();
  for (const match of html.matchAll(/["'(](\/_next\/static\/[^"'()\s]+)/g)) urls.add(match[1]);
  const cache = await caches.open(STATIC);
  for (const url of urls) {
    if (await cache.match(url)) continue;
    try {
      const response = await fetch(url);
      if (response.ok) await cache.put(url, response);
    } catch {
      // Best effort; the next visit tries again.
    }
  }
  const keys = await cache.keys();
  for (const old of keys.slice(0, Math.max(0, keys.length - STATIC_LIMIT))) await cache.delete(old);
}

async function shell(event) {
  const cache = await caches.open(DATA);
  try {
    const response = await fetch(event.request);
    const type = response.headers.get("content-type") || "";
    if (response.ok && !response.redirected && type.includes("text/html")) {
      await cache.put("/", response.clone());
      event.waitUntil(response.clone().text().then(precacheAssets));
    }
    return response;
  } catch {
    return (await cache.match("/")) || offlinePage();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    if (url.pathname === "/") {
      event.respondWith(shell(event));
    } else {
      event.respondWith(fetch(request).catch(offlinePage));
    }
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request, STATIC));
    return;
  }

  // The full list only — a search is a question about now, never answered from a copy.
  if (url.pathname === "/api/notes" && !url.searchParams.get("q") && url.searchParams.get("filter") === "all") {
    event.respondWith(networkFirst(request, "/api/notes?filter=all"));
    return;
  }
  if (/^\/api\/notes\/[^/]+$/.test(url.pathname)) {
    event.respondWith(networkFirst(request, url.pathname));
    return;
  }
  // A ranged request is audio seeking (PRD §4.74): the network answers it,
  // since a cached whole file cannot.
  if (/^\/api\/attachments\/[^/]+$/.test(url.pathname) && url.pathname !== "/api/attachments/unused" && !request.headers.has("range")) {
    event.respondWith(
      caches.open(DATA).then(async (cache) => {
        const hit = await cache.match(url.pathname);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) await cache.put(url.pathname, response.clone());
        return response;
      }),
    );
  }
  // Everything else (writes, search, settings, auth) goes straight to the network.
});
