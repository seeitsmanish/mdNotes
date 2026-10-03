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

export type SaveStatus = "idle" | "saving" | "failed";

export function useAutosave(save: (id: string, body: string) => Promise<void>) {
  const pending = useRef(new Map<string, string>());
  const inFlight = useRef(new Set<string>());
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
    setStatus("saving");

    try {
      await saveRef.current(id, body);
      setStatus(pending.current.size > 0 ? "saving" : "idle");
    } catch {
      // Put the body back so the next flush retries it rather than losing it.
      if (!pending.current.has(id)) pending.current.set(id, body);
      setStatus("failed");
    } finally {
      inFlight.current.delete(id);
      if (pending.current.has(id)) void flushOne(id);
    }
  }, []);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    for (const id of [...pending.current.keys()]) void flushOne(id);
  }, [flushOne]);

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
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  return { queue, flush, status, hasPending: () => pending.current.size > 0 };
}
