"use client";

import { createDeduper } from "./report";

/**
 * Send a client error to the server log (PRD §4.32). Never throws, never
 * blocks: a failure to report must not become a second failure.
 */
const firstTime = createDeduper(60_000);

export function reportError(error: unknown, source: string): void {
  try {
    const message =
      error instanceof Error ? `${error.name}: ${error.message}` : typeof error === "string" ? error : JSON.stringify(error);
    if (!message || !firstTime(`${source}|${message}`)) return;
    void fetch("/api/log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        message,
        stack: error instanceof Error ? (error.stack ?? null) : null,
        source,
        path: window.location.pathname,
        release: process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown",
      }),
    }).catch(() => undefined);
  } catch {
    // Reporting is best effort.
  }
}

/** Uncaught errors and unhandled rejections, for the life of the page. */
export function installGlobalReporting(): () => void {
  const onError = (event: ErrorEvent) => reportError(event.error ?? event.message, "window");
  const onRejection = (event: PromiseRejectionEvent) => reportError(event.reason, "promise");
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
