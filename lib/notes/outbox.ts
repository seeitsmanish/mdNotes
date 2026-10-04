/**
 * Edits not yet confirmed by the server, kept on the device (PRD §4.55).
 *
 * Autosave holds unsent text in memory and retries; that survives a dropped
 * connection only while the tab lives. A phone that closes the tab, or an
 * app killed in the background, lost whatever was typed offline. Every edit
 * is now also written here with the version it was built on, cleared when
 * the server confirms that exact text, and replayed on the next launch
 * through the normal versioned save — so a clash becomes a conflicted copy
 * (§4.18), never an overwrite.
 *
 * Storage is injected so the logic is testable; the app uses localStorage
 * (synchronous, so a write cannot be lost to a closing tab mid-await).
 */

export interface OutboxEntry {
  id: string;
  body: string;
  /** The note version this text was built on, or null if unknown. */
  base: number | null;
  at: number;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

const PREFIX = "ursa-outbox:";

/**
 * Sent as the base version when the real one is unknown: valid to the API
 * (a non-negative integer that fits the Int column) and never a real version,
 * so the save always takes the conflicted-copy path.
 */
export const UNKNOWN_BASE = 2_147_483_647;

export function createOutbox(store: KeyValueStore | null) {
  const safe = <T>(fn: () => T, fallback: T): T => {
    try {
      return store ? fn() : fallback;
    } catch {
      // Full or blocked storage (private mode): the in-memory autosave still
      // works; the device copy is a bonus, never a reason to fail typing.
      return fallback;
    }
  };

  return {
    put(id: string, body: string, base: number | null, now = Date.now()): void {
      safe(() => store!.setItem(PREFIX + id, JSON.stringify({ id, body, base, at: now })), undefined);
    },

    /** Forget `id` — but only if what is stored is `body`, so newer typing survives. */
    settle(id: string, body: string): void {
      safe(() => {
        const raw = store!.getItem(PREFIX + id);
        if (!raw) return;
        const entry = JSON.parse(raw) as OutboxEntry;
        if (entry.body === body) store!.removeItem(PREFIX + id);
      }, undefined);
    },

    remove(id: string): void {
      safe(() => store!.removeItem(PREFIX + id), undefined);
    },

    all(): OutboxEntry[] {
      return safe(() => {
        const out: OutboxEntry[] = [];
        for (let i = 0; i < store!.length; i += 1) {
          const key = store!.key(i);
          if (!key?.startsWith(PREFIX)) continue;
          try {
            const entry = JSON.parse(store!.getItem(key) ?? "") as OutboxEntry;
            if (typeof entry.id === "string" && typeof entry.body === "string") out.push(entry);
          } catch {
            // A corrupt entry is skipped, not fatal.
          }
        }
        return out.sort((a, b) => a.at - b.at);
      }, []);
    },
  };
}

/**
 * What to do with an outbox entry on launch, given the server's copy:
 * nothing to send (already saved, or empty), recreate it (the note is gone),
 * or send it through the versioned save.
 */
export function replayPlan(
  entry: OutboxEntry,
  server: { body: string; version: number } | null,
): "drop" | "recreate" | "send" {
  if (server === null) return entry.body.trim() ? "recreate" : "drop";
  if (server.body === entry.body) return "drop";
  return "send";
}
