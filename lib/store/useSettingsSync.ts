"use client";

import { useEffect, useRef } from "react";
import { selectSynced, type SyncedSettings, useUiStore } from "./useUiStore";

/**
 * Keeps the synced half of appearance in step with the database (PRD §4.6).
 *
 * Writes are debounced and fire-and-forget: dragging the radius slider must not
 * issue a request per frame (R6.4), and a failed sync must never block the UI —
 * the localStorage cache still holds the change, so the next write retries it.
 */

const DEBOUNCE_MS = 600;

export function useSettingsSync(initial: SyncedSettings | null) {
  const applyServerSettings = useUiStore((state) => state.applyServerSettings);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Nothing is sent until the server's own values have been applied, otherwise
  // the first render would immediately write defaults back over them.
  const ready = useRef(false);
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    // Order matters: the localStorage cache rehydrates first (it exists only to
    // avoid a flash), then the database overrides it as the source of truth.
    void useUiStore.persist.rehydrate();
    if (initial) applyServerSettings(initial);
    lastSent.current = JSON.stringify(initial ?? selectSynced(useUiStore.getState()));
    ready.current = true;
  }, [initial, applyServerSettings]);

  useEffect(() => {
    const unsubscribe = useUiStore.subscribe((state) => {
      if (!ready.current) return;

      const next = selectSynced(state);
      const encoded = JSON.stringify(next);
      if (encoded === lastSent.current) return;
      lastSent.current = encoded;

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void fetch("/api/settings", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: encoded,
        }).catch(() => {
          // Offline or a failed save: the local value stands and the next
          // change retries. Appearance is not worth an error toast.
          lastSent.current = null;
        });
      }, DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
}
