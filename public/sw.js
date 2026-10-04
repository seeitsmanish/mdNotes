/*
 * The service worker (PRD §4.27).
 *
 * Deliberately small. It caches nothing that belongs to you: a cached note is
 * a stale note, and a stale note written back is a lost edit. It exists so the
 * app can be installed, and so that opening it with no connection shows a
 * plain "you're offline" page instead of the browser's error screen.
 */

const OFFLINE_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>myNotes — offline</title>
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
  <p>myNotes keeps your notes on the server, so it needs a connection to open them. Nothing has been lost.</p>
  <button onclick="location.reload()">Try again</button>
</main></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  // Only page loads get the fallback; API calls must fail loudly so the app's
  // own error handling — and autosave's retry — see the failure.
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { headers: { "content-type": "text/html; charset=utf-8" } }),
    ),
  );
});
