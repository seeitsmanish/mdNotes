"use client";

import { useSyncExternalStore } from "react";

/** The service worker's copy of notes, the page and images (public/sw.js). */
const DATA_CACHE = "mdnotes-data-v1";

/**
 * Remove every note copy kept for offline use (PRD R56.4). Called on sign-out
 * and whenever the sign-in page loads — the latter catches a session ended on
 * another device, so notes do not stay on a device no longer signed in.
 */
export async function clearOfflineData(): Promise<void> {
  try {
    if (typeof caches !== "undefined") await caches.delete(DATA_CACHE);
  } catch {
    // Storage blocked: nothing was cached either.
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Whether the browser reports a connection; true on the server and in hydration. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
