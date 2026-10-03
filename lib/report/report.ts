/**
 * Client error reports (PRD §4.32). Pure: validation on the server's side,
 * de-duplication on the client's — both testable without a browser.
 */

export interface ClientReport {
  message: string;
  stack: string | null;
  /** Where it came from: "window", "promise", "action:create", "render" … */
  source: string;
  /** Path only, never the query — a share's text must not reach the logs. */
  path: string;
  release: string;
}

const LIMITS = { message: 500, stack: 4000, source: 60, path: 200, release: 40 } as const;

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, max);
}

/** An untrusted request body → a bounded report, or null if it is not one. */
export function normaliseReport(payload: unknown): ClientReport | null {
  if (typeof payload !== "object" || payload === null) return null;
  const raw = payload as Record<string, unknown>;
  const message = text(raw.message, LIMITS.message);
  if (!message) return null;
  const path = (text(raw.path, LIMITS.path) ?? "/").split(/[?#]/)[0] ?? "/";
  return {
    message,
    stack: text(raw.stack, LIMITS.stack),
    source: text(raw.source, LIMITS.source) ?? "unknown",
    path: path.startsWith("/") ? path : "/",
    release: text(raw.release, LIMITS.release) ?? "unknown",
  };
}

/**
 * True the first time a key is seen within `windowMs`. A failing save retried
 * with backoff, or an error thrown on every render, must produce one report,
 * not hundreds.
 */
export function createDeduper(windowMs: number, now: () => number = Date.now) {
  const seen = new Map<string, number>();
  return (key: string): boolean => {
    const at = now();
    for (const [k, t] of seen) if (at - t >= windowMs) seen.delete(k);
    if (seen.has(key)) return false;
    seen.set(key, at);
    return true;
  };
}
