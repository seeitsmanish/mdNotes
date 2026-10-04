/**
 * Coming back to the app (PRD §4.42): whether the open note should take the
 * server's copy. Only when this client holds nothing unsaved — unsaved text
 * always wins, and a stale save of it becomes a conflicted copy (§4.18) — and
 * the server has moved past the version this client's text was built on.
 */
export function shouldAdopt(input: {
  hasUnsaved: boolean;
  localVersion: number | undefined;
  serverVersion: number;
}): boolean {
  if (input.hasUnsaved) return false;
  if (input.localVersion === undefined) return true;
  return input.serverVersion > input.localVersion;
}

/** Long enough that flicking between apps does not refetch on every switch. */
export const RESYNC_AFTER_MS = 10_000;

export function shouldResync(hiddenAt: number | null, now: number): boolean {
  return hiddenAt !== null && now - hiddenAt >= RESYNC_AFTER_MS;
}
