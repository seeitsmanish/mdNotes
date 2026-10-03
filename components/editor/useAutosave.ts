"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Debounced autosave (PRD R2.5, docs/TECH-SPEC.md §4.3).
 *
 * Pending bodies are keyed by note id, which is what makes switching notes
 * mid-sentence safe: the save for the note being left is flushed, not
 * cancelled. A note already in flight is not saved twice concurrently — the
 * newer body waits and goes out when the first completes.
 */

const DEBOUNCE_MS = 400;
/** Backoff for a failing save: 1s, 2s, 4s … capped. */
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 30_000;

export type SaveStatus = "idle" | "saving" | "failed";

export function useAutosave(save: (id: string, body: string) => Promise<void>) {
  const pending = useRef(new Map<string, string>());
  const inFlight = useRef(new Set<string>());
  // What each in-flight request is trying to persist, kept until it lands.
  const inFlightBody = useRef(new Map<string, string>());
  const failures = useRef(new Map<string, number>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  const [status, setStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const flushOne = useCallback(async (id: string) => {
    const body = pending.current.get(id);
    if (body === undefined) return;
    if (inFlight.current.has(id)) return; // picked up when the current save lands

    pending.current.delete(id);
    inFlight.current.add(id);
    inFlightBody.current.set(id, body);
    setStatus("saving");

    try {
      await saveRef.current(id, body);
      failures.current.delete(id);
      setStatus(pending.current.size > 0 ? "saving" : "idle");
    } catch {
      // Put the body back so the next flush retries it rather than losing it.
      if (!pending.current.has(id)) pending.current.set(id, body);
      failures.current.set(id, (failures.current.get(id) ?? 0) + 1);
      setStatus("failed");
    } finally {
      inFlight.current.delete(id);
      inFlightBody.current.delete(id);

      if (pending.current.has(id)) {
        // Retrying immediately turned a persistent failure — offline, an
        // expired session, a deleted note — into a hot loop that burned CPU
        // and serverless invocations while never succeeding.
        const attempts = failures.current.get(id) ?? 0;
        const delay =
          attempts === 0 ? 0 : Math.min(RETRY_BASE_MS * 2 ** (attempts - 1), RETRY_MAX_MS);
        setTimeout(() => void flushOne(id), delay);
      }
    }
  }, []);

  const flush = useCallback(
    (options: { unloading?: boolean } = {}) => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }

      for (const id of [...pending.current.keys()]) {
        if (options.unloading) {
          // The browser cancels in-flight fetches when the document goes away,
          // so the last write of a session has to be sent as a keepalive
          // request that survives it.
          const body = pending.current.get(id);
          if (body === undefined) continue;
          pending.current.delete(id);
          void fetch(`/api/notes/${id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ body }),
            keepalive: true,
          }).catch(() => undefined);
          continue;
        }
        void flushOne(id);
      }
    },
    [flushOne],
  );

  const queue = useCallback(
    (id: string, body: string) => {
      pending.current.set(id, body);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void flushOne(id);
      }, DEBOUNCE_MS);
    },
    [flushOne],
  );

  // Closing the tab mid-sentence must cost at most the debounce window, which
  // is the "no data loss" line in the PRD's success criteria.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush({ unloading: true });
    };
    document.addEventListener("visibilitychange", onHidden);
    const onPageHide = () => flush({ unloading: true });
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
      flush();
    };
  }, [flush]);

  /**
   * The newest body this client has for `id` that the server may not have yet.
   *
   * This exists to close a data-loss race: a GET issued while a save is still
   * in flight returns the pre-edit body, and adopting it would reset the editor
   * and then write the stale text back over the good one.
   */
  const unsavedBody = useCallback(
    (id: string): string | undefined => pending.current.get(id) ?? inFlightBody.current.get(id),
    [],
  );

  return { queue, flush, status, unsavedBody, hasPending: () => pending.current.size > 0 };
}
