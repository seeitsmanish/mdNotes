"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "@/lib/api";
import { useAutosave } from "@/components/editor/useAutosave";
import { displayTitle } from "@/lib/markdown/derive";
import { safeStem } from "@/lib/export/filename";
import { normaliseTitle } from "@/lib/markdown/wikilink";
import { conflictCopyBody } from "@/lib/notes/conflict";
import { duplicateBody } from "@/lib/notes/duplicate";
import { printHtml } from "@/lib/export/print";
import { bodyFromTemplate, dailyBody, dailyTitle } from "@/lib/notes/daily";
import { STARTER_TEMPLATES, starterTitle } from "@/lib/notes/starterTemplates";
import { COLOR_LABEL, NOTE_COLORS } from "@/lib/notes/colors";
import { markdownToHtml } from "@/lib/export/toHtml";
import { shouldAdopt, shouldResync } from "@/lib/notes/resync";
import { createOutbox, replayPlan, UNKNOWN_BASE } from "@/lib/notes/outbox";
import { loadRecent, pushRecent, recentNotes, saveRecent } from "@/lib/notes/recent";
import { LIST_BOUNDS, THEMES, type SyncedSettings, useUiStore } from "@/lib/store/useUiStore";
import { useSettingsSync } from "@/lib/store/useSettingsSync";
import type { Clock } from "@/lib/clock";
import type { NoteCounts, NoteDetail, NoteListItem } from "@/lib/types";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { applyFavicon } from "@/lib/favicon";
import { haptic, setHapticsEnabled } from "@/lib/gestures/haptics";
import { EDGE_WIDTH, edgeBack } from "@/lib/gestures/swipe";
import { applyAppearance } from "@/lib/theme";
import { CommandPalette, type Command } from "./CommandPalette";
import type { LabelPatch } from "./EditorPane";
import type { BulkAction } from "./NoteList";
import { ShareLinkDialog } from "./ShareLinkDialog";
import { PasscodeDialog, UnlockAllDialog } from "./LockDialog";
import { QuickCapture } from "./QuickCapture";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { HistoryDialog } from "./HistoryDialog";
import { createGate } from "@/lib/async/gate";
import { installApp, registerServiceWorker, useInstallMode } from "@/lib/pwa/install";
import { useOnline } from "@/lib/pwa/offlineData";
import { installGlobalReporting, reportError } from "@/lib/report/client";
import { ClockProvider } from "./ClockProvider";
import { EditorPane } from "./EditorPane";
import { NoteList } from "./NoteList";
import { PaneDivider } from "./PaneDivider";
import { Workbench } from "@/components/workbench/Workbench";
import type { TabInfo } from "@/components/workbench/GroupTabs";
import * as W from "@/lib/workbench/workbench";
import type { Group } from "@/lib/workbench/group";
import { chordAction, isMac, keyAction } from "@/lib/workbench/keys";
import { PRESETS } from "@/lib/workbench/layout";

/**
 * Two-pane shell: note list and editor. Owns the fetched data and the keyboard
 * map; the panes below it are presentational.
 */

interface ShellProps {
  initialNotes: NoteListItem[];
  initialClock: Clock;
  initialCounts: NoteCounts;
  initialSettings: SyncedSettings | null;
}

const SEARCH_DEBOUNCE_MS = 220;

/** What to say when a gated action fails, by the first part of its key. */
const FAILURE: Record<string, string> = {
  create: "Couldn’t create a note.",
  pin: "Couldn’t change the pin.",
  trash: "Couldn’t move the note to trash.",
  restore: "Couldn’t restore the note.",
  delete: "Couldn’t delete the note.",
  "empty-trash": "Couldn’t empty the trash.",
  link: "Couldn’t create the linked note.",
};

function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export function Shell({ initialNotes, initialCounts, initialSettings, initialClock }: ShellProps) {
  const filter = useUiStore((state) => state.filter);
  const colorFilter = useUiStore((state) => state.colorFilter);
  const paletteOpenNow = useUiStore((state) => state.paletteOpen);
  const setFilter = useUiStore((state) => state.setFilter);
  const query = useUiStore((state) => state.query);
  const setQuery = useUiStore((state) => state.setQuery);
  const selectedNoteId = useUiStore((state) => state.selectedNoteId);
  const selectNote = useUiStore((state) => state.selectNote);
  const mobilePane = useUiStore((state) => state.mobilePane);
  const setMobilePane = useUiStore((state) => state.setMobilePane);
  // Editor groups and tabs (PRD §4.81).
  const splitAvailable = useUiStore((state) => state.splitAvailable);
  const openNote = useUiStore((state) => state.openNote);
  const workbench = useUiStore((state) => state.workbench);
  const setSplitAvailable = useUiStore((state) => state.setSplitAvailable);
  /** Every note a group shows; each must be loaded to draw the grid. */
  const visibleKey = useUiStore((state) =>
    (state.splitAvailable ? W.visibleNotes(state.wb) : state.selectedNoteId ? [state.selectedNoteId] : []).join(","),
  );
  const listWidth = useUiStore((state) => state.listWidth);
  const setListWidth = useUiStore((state) => state.setListWidth);
  const focusMode = useUiStore((state) => state.focusMode);
  const toggleFocusMode = useUiStore((state) => state.toggleFocusMode);
  const paletteOpen = useUiStore((state) => state.paletteOpen);
  const setPaletteOpen = useUiStore((state) => state.setPaletteOpen);
  const setSettingsOpen = useUiStore((state) => state.setSettingsOpen);
  const shortcutsOpen = useUiStore((state) => state.shortcutsOpen);
  const toggleOutline = useUiStore((state) => state.toggleOutline);
  const setShortcutsOpen = useUiStore((state) => state.setShortcutsOpen);
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);

  const [notes, setNotes] = useState(initialNotes);
  const [counts, setCounts] = useState(initialCounts);
  /**
   * Notes loaded for display, by id: one per group showing it (§4.81). The
   * active group's is `note`, which every note action works on.
   */
  const [loadedNotes, setLoadedNotes] = useState<Record<string, NoteDetail>>({});
  const note = selectedNoteId ? (loadedNotes[selectedNoteId] ?? null) : null;
  const loadedNotesRef = useRef(loadedNotes);
  loadedNotesRef.current = loadedNotes;
  /**
   * Update loaded notes. Given a note, it is stored; given a function, it is
   * applied to each loaded note in turn — the callers' functions change only
   * the note whose id they name, wherever it is shown.
   */
  const setNote = useCallback(
    (update: NoteDetail | null | ((prev: NoteDetail | null) => NoteDetail | null)) => {
      setLoadedNotes((map) => {
        if (update === null) return map;
        if (typeof update !== "function") return { ...map, [update.id]: update };
        let changed = false;
        const next: Record<string, NoteDetail> = {};
        for (const [id, current] of Object.entries(map)) {
          const result = update(current);
          if (result !== current) changed = true;
          if (result) next[result.id] = result;
        }
        return changed ? next : map;
      });
    },
    [],
  );
  const [loading, setLoading] = useState(false);
  /**
   * The editor's latest text per note. A ref, not state: it changes on every
   * keystroke and only matters when something needs "what is in the editor
   * now" — the history dialog's comparison (PRD §4.28). `note.body` is the
   * text as loaded, which goes stale as soon as you type.
   */
  const liveBody = useRef(new Map<string, string>());

  const [historyOpen, setHistoryOpen] = useState(false);
  /** Notes being fetched after a switch (PRD §4.25), by id. */
  const [loadingIds, setLoadingIds] = useState<ReadonlySet<string>>(() => new Set());
  // A note that failed to open says so, with Retry, instead of silently
  // showing the empty "Pick a note" screen (PRD R25.5).
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
  /** Asks for a note to be fetched again: Retry, after unlocking, after re-locking. */
  const [reloads, setReloads] = useState<Record<string, number>>({});
  const reloadNote = useCallback((id: string) => setReloads((r) => ({ ...r, [id]: (r[id] ?? 0) + 1 })), []);
  const noteLoading = selectedNoteId ? loadingIds.has(selectedNoteId) : false;
  const noteError = selectedNoteId ? (loadErrors[selectedNoteId] ?? null) : null;

  // Network actions run one at a time per key, show while they run, and say
  // when they fail (PRD §4.25).
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const gate = useMemo(
    () =>
      createGate({
        onChange: (keys) => setPending(new Set(keys)),
        onError: (key, error) => {
          reportError(error, `action:${key.split(":")[0]}`);
          toast.error(FAILURE[key.split(":")[0] ?? ""] ?? "Something went wrong.", {
            description: error instanceof Error ? error.message : undefined,
          });
        },
      }),
    [],
  );
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  const listRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  /** A note created but never typed into is discarded on exit. */
  const freshNoteId = useRef<string | null>(null);

  // Rehydrates the localStorage cache, applies the server's settings over it,
  // and writes later changes back (PRD §4.6).
  useSettingsSync(initialSettings);

  const brandColor = useUiStore((state) => state.brandColor);
  const radius = useUiStore((state) => state.radius);
  const headingMode = useUiStore((state) => state.headingMode);

  useEffect(() => {
    applyAppearance(document.documentElement, { brandColor, radius, headingMode });
  }, [brandColor, radius, headingMode]);

  const [shareLinkOpen, setShareLinkOpen] = useState(false);
  // Note-lock passcode dialog (PRD §4.69); `then` runs once a passcode is set.
  const [passcodeDialog, setPasscodeDialog] = useState<{ changing: boolean; scope?: string; then?: () => void } | null>(null);
  const [unlockAllOpen, setUnlockAllOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const hapticsOn = useUiStore((state) => state.haptics);
  useEffect(() => setHapticsEnabled(hapticsOn), [hapticsOn]);

  // The tab icon follows the theme and accent (PRD §4.60). Only once the saved
  // settings are back, or a reload would flash the default icon.
  useEffect(() => {
    const apply = () => {
      const state = useUiStore.getState();
      applyFavicon(document, state.theme, state.brandColor);
    };
    if (useUiStore.persist.hasHydrated()) apply();
    const unsubscribe = useUiStore.persist.onFinishHydration(apply);
    // Next streams its metadata icon links in after mount; recolour those too,
    // or the static icon declared after ours is the one the tab shows.
    const observer = new MutationObserver(() => {
      if (useUiStore.persist.hasHydrated()) apply();
    });
    observer.observe(document.head, { childList: true });
    return () => {
      unsubscribe();
      observer.disconnect();
    };
  }, [theme, brandColor]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);

    // shadcn's `dark:` variant keys off a class, so it has to track the theme.
    const dark =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : (THEMES.find((entry) => entry.value === theme)?.dark ?? false);
    root.classList.toggle("dark", dark);
  }, [theme]);

  /** Bumped to ask the note list to open its search field (PRD §4.31). */
  const [searchSignal, setSearchSignal] = useState(0);

  // Installable app (PRD §4.27).
  const installMode = useInstallMode();
  useEffect(() => registerServiceWorker(), []);
  // Client failures reach the server log instead of vanishing (PRD §4.32).
  useEffect(() => installGlobalReporting(), []);

  // --- data ----------------------------------------------------------------

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const refreshList = useCallback(async () => {
    const result = await api.fetchNotes({ filter, query: debouncedQuery, color: colorFilter });
    setNotes(result.notes);
    setCounts(result.counts);
    return result.notes;
  }, [colorFilter, debouncedQuery, filter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refreshList()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshList]);

  // Every note a group shows is fetched when it comes into view — on a
  // switch, as before, and now for each group (§4.81) — and again on request.
  const fetching = useRef(new Map<string, AbortController>());
  const shownBefore = useRef(new Set<string>());
  const reloadsSeen = useRef<Record<string, number>>({});
  useEffect(() => {
    const ids = visibleKey ? visibleKey.split(",") : [];
    const visible = new Set(ids);
    const setLoading = (id: string, on: boolean) =>
      setLoadingIds((prev) => {
        if (prev.has(id) === on) return prev;
        const next = new Set(prev);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      });

    // A superseded request must not land after the one that replaced it.
    for (const [id, controller] of fetching.current) {
      if (visible.has(id)) continue;
      controller.abort();
      fetching.current.delete(id);
      setLoading(id, false);
    }

    for (const id of ids) {
      const asked = reloads[id] ?? 0;
      if (shownBefore.current.has(id) && (reloadsSeen.current[id] ?? 0) === asked) continue;
      reloadsSeen.current[id] = asked;
      fetching.current.get(id)?.abort();
      const controller = new AbortController();
      fetching.current.set(id, controller);
      setLoading(id, true);
      setLoadErrors((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });

      // One quiet retry: a request cut off by the browser (Safari's Esc stops
      // loading) or a blip on a phone network should not lose the note.
      api
        .fetchNote(id, controller.signal)
        .catch(async (error: unknown) => {
          if (controller.signal.aborted || (error instanceof api.ApiError && error.status === 404)) throw error;
          await new Promise((resolve) => setTimeout(resolve, 400));
          return api.fetchNote(id, controller.signal);
        })
        .then(({ note: loaded }) => {
          if (controller.signal.aborted) return;
          // If this client still holds text the server has not acknowledged, the
          // response is stale by definition — keep the local body. Adopting the
          // server's copy here is what used to truncate notes on switch-away and
          // switch-back.
          const local = unsavedBodyRef.current(loaded.id);
          // The version travels with the text it describes: adopt the server's
          // only when adopting its body. Unsaved local text was built on the
          // version this client already holds (PRD R18.2).
          if (local === undefined || !versions.current.has(loaded.id)) {
            versions.current.set(loaded.id, loaded.version);
          }
          const adopted = local === undefined ? loaded : { ...loaded, body: local };
          liveBody.current.set(adopted.id, adopted.body);
          setNote(adopted);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          // Deleted since its tab was opened (another device, or a reload of an
          // old layout): the tab goes rather than showing an error (§4.81).
          if (error instanceof api.ApiError && error.status === 404) {
            useUiStore.getState().workbench((wb) => W.closeEverywhere(wb, id));
            if (!useUiStore.getState().splitAvailable && useUiStore.getState().selectedNoteId === id) {
              useUiStore.getState().selectNote(null);
            }
            return;
          }
          setLoadErrors((prev) => ({ ...prev, [id]: error instanceof Error ? error.message : "Couldn’t open this note." }));
        })
        .finally(() => {
          if (fetching.current.get(id) !== controller) return;
          fetching.current.delete(id);
          setLoading(id, false);
        });
    }
    shownBefore.current = visible;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey, reloads]);

  // Notes no longer in any tab are let go.
  const openKey = useUiStore((state) => [...W.openNotes(state.wb), state.selectedNoteId ?? ""].join(","));
  useEffect(() => {
    const keep = new Set(openKey.split(","));
    setLoadedNotes((map) => {
      const gone = Object.keys(map).filter((id) => !keep.has(id));
      if (gone.length === 0) return map;
      const next = { ...map };
      for (const id of gone) delete next[id];
      return next;
    });
  }, [openKey]);

  // --- saving --------------------------------------------------------------

  const unsavedBodyRef = useRef<(id: string) => string | undefined>(() => undefined);
  const takePendingRef = useRef<(id: string) => string | undefined>(() => undefined);
  const queueRef = useRef<(id: string, body: string) => void>(() => undefined);
  const openNoteRef = useRef<(id: string) => void>(() => undefined);

  /**
   * The body version each note's text in this client was built on (PRD §4.18).
   * Advanced only by this client's own acknowledged saves and by adopting a
   * body from the server, never by anything else — that is what lets a save
   * say truthfully which version it was edited from.
   */
  const versions = useRef(new Map<string, number>());
  const online = useOnline();
  // Screen-sharing blur (PRD §4.59): one attribute on <html>; CSS blurs every
  // element marked data-ursa-private, wherever it renders (palette included).
  const privacyMode = useUiStore((state) => state.privacyMode);
  useEffect(() => {
    // Not before the saved settings are back: the first render's default
    // (off) would undo the bootstrap's blur for a frame (PRD R59.4).
    const apply = () =>
      document.documentElement.toggleAttribute("data-ursa-privacy", useUiStore.getState().privacyMode);
    if (useUiStore.persist.hasHydrated()) apply();
    return useUiStore.persist.onFinishHydration(apply);
  }, [privacyMode]);

  // Weekly backup and trash clean-out (PRD §4.77): asked for once per visit,
  // a little after launch so it never competes with opening a note.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("ursa-maintenance")) return;
      sessionStorage.setItem("ursa-maintenance", "1");
    } catch {
      // No storage: ask anyway; the server makes it a no-op when nothing is due.
    }
    const timer = setTimeout(() => {
      void fetch("/api/maintenance", { method: "POST" })
        .then((r) => (r.ok ? (r.json() as Promise<{ purged: number }>) : null))
        .then((result) => {
          if (result?.purged) void refreshList();
        })
        .catch(() => undefined);
    }, 8000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A few minutes without touching the app hides titles too (PRD §4.68): a
  // laptop left open on a desk, or a shared screen forgotten mid-call.
  const idleHideMinutes = useUiStore((state) => state.idleHideMinutes);
  useEffect(() => {
    if (!idleHideMinutes) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const hide = () => {
      const state = useUiStore.getState();
      if (!useUiStore.persist.hasHydrated() || state.privacyMode) return;
      document.documentElement.setAttribute("data-ursa-privacy", "");
      state.togglePrivacyMode();
    };
    const reset = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(hide, idleHideMinutes * 60_000);
    };
    const events = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"] as const;
    for (const name of events) window.addEventListener(name, reset, { passive: true, capture: true });
    reset();
    return () => {
      if (timer) clearTimeout(timer);
      for (const name of events) window.removeEventListener(name, reset, { capture: true });
    };
  }, [idleHideMinutes]);

  // Leaving the tab or app hides titles (PRD §4.62), so coming back mid-call,
  // or the phone's app switcher, never shows the list. Set on <html> at once:
  // the OS snapshots the page before React would re-render. Coming back
  // leaves them hidden until Show.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState !== "hidden" || !useUiStore.persist.hasHydrated()) return;
      const state = useUiStore.getState();
      if (!state.autoPrivacy || state.privacyMode) return;
      document.documentElement.setAttribute("data-ursa-privacy", "");
      state.togglePrivacyMode();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  // Recently opened notes for ⌘K (PRD §4.57).
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => setRecentIds(loadRecent()), []);
  useEffect(() => {
    if (!selectedNoteId) return;
    setRecentIds((prev) => {
      const next = pushRecent(prev, selectedNoteId);
      saveRecent(next);
      return next;
    });
  }, [selectedNoteId]);

  /** Unconfirmed edits kept on the device (PRD §4.55); a ref for callbacks made earlier. */
  const outbox = useMemo(
    () => createOutbox(typeof window === "undefined" ? null : (() => {
      try {
        return window.localStorage;
      } catch {
        return null;
      }
    })()),
    [],
  );
  const outboxRef = useRef(outbox);

  const onConflict = useCallback((id: string, current: NoteDetail, copy: NoteDetail) => {
    versions.current.set(id, current.version);
    versions.current.set(copy.id, copy.version);

    // Anything typed while the losing save was in flight was built on the
    // losing text too, so it follows that text to the copy (R18.4).
    const newer = takePendingRef.current(id);
    if (newer !== undefined) {
      // The device copy follows the text to the copy too (PRD §4.55).
      outboxRef.current.remove(id);
      outboxRef.current.put(copy.id, conflictCopyBody(newer), copy.version);
      queueRef.current(copy.id, conflictCopyBody(newer));
    }

    // Replacing the body resets the editor to the current text.
    liveBody.current.set(id, current.body);
    setNote((prev) => (prev && prev.id === id ? current : prev));
    setNotes((prev) => [
      toListItem(copy),
      ...prev.map((row) => (row.id === id ? toListItem(current) : row)),
    ]);
    setCounts((prev) => ({ ...prev, all: prev.all + 1 }));

    toast(`“${displayTitle(current.title)}” was changed on another device.`, {
      description: "This shows the latest version. Your edits were kept as a separate note.",
      duration: 15_000,
      action: { label: "Open your version", onClick: () => openNoteRef.current(copy.id) },
    });
  }, []);

  const { queue, flush, status, unsavedBody, takePending } = useAutosave(
    useCallback(
      async (id: string, body: string) => {
        const result = await api.saveBody(id, body, versions.current.get(id)).catch((error: unknown) => {
          // Autosave retries with backoff; one report per distinct failure.
          reportError(error, "autosave");
          throw error;
        });
        // Either way the text is now on the server — in the note, or kept as
        // its conflicted copy — so the device copy of it can go.
        outbox.settle(id, body);
        if (result.status === "conflict") {
          onConflict(id, result.note, result.copy);
          return;
        }

        const saved = result.note;
        versions.current.set(id, saved.version);
        // Merge everything except `body`: the user may have typed more since this
        // request left, and overwriting the editor's source would undo those
        // keystrokes (docs/TECH-SPEC.md §4.3).
        setNote((prev) => (prev && prev.id === saved.id ? { ...saved, body: prev.body } : prev));
        setNotes((prev) => prev.map((row) => (row.id === saved.id ? toListItem(saved) : row)));
      },
      [onConflict, outbox],
    ),
    useMemo(
      () => ({
        sendOnUnload: (id: string, body: string) => {
          // The save ahead of this one will, if it lands, advance the version
          // by one. If it does not, this one is stale and the server keeps it
          // as a copy — so a wrong guess costs a duplicate, never the text.
          const base = versions.current.get(id);
          void fetch(`/api/notes/${id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ body, baseVersion: base === undefined ? undefined : base + 1 }),
            keepalive: true,
          }).catch(() => undefined);
        },
      }),
      [],
    ),
  );

  unsavedBodyRef.current = unsavedBody;
  takePendingRef.current = takePending;
  queueRef.current = queue;

  const onBodyChange = useCallback(
    (id: string, body: string) => {
      liveBody.current.set(id, body);
      outbox.put(id, body, versions.current.get(id) ?? null);
      if (freshNoteId.current === id && body.length > 0) freshNoteId.current = null;
      queue(id, body);
      // Typing in a preview tab keeps it (§4.81).
      const wb = useUiStore.getState().wb;
      if (Object.values(wb.groups).some((g) => g.preview === id)) {
        useUiStore.getState().workbench((w) => W.keepEverywhere(w, id));
      }
    },
    [outbox, queue],
  );

  /**
   * A note trashed or deleted: its tabs close in every group (§4.81). On a
   * phone, if it was the note on screen, back to the list.
   */
  const closeNoteEverywhere = useCallback((id: string) => {
    const state = useUiStore.getState();
    state.workbench((wb) => W.closeEverywhere(wb, id));
    if (!state.splitAvailable && state.selectedNoteId === id) state.selectNote(null);
  }, []);

  const discardFreshIfEmpty = useCallback(async () => {
    const id = freshNoteId.current;
    if (!id) return;
    freshNoteId.current = null;
    try {
      await api.deleteNoteForever(id);
      setNotes((prev) => prev.filter((row) => row.id !== id));
      closeNoteEverywhere(id);
    } catch {
      // A failed cleanup is harmless — the note stays as an empty row.
    }
  }, [closeNoteEverywhere]);

  // --- edits written offline (PRD §4.55) -------------------------------------

  // On launch, anything still in the device outbox was never confirmed —
  // typed offline, or the tab closed first. Each goes back through autosave
  // with the version it was built on, so a clash becomes a conflicted copy.
  useEffect(() => {
    const entries = outbox.all();
    if (entries.length === 0) return;
    let cancelled = false;
    void (async () => {
      let restored = 0;
      for (const entry of entries) {
        if (cancelled) return;
        let server: NoteDetail | null = null;
        try {
          server = (await api.fetchNote(entry.id)).note;
        } catch (error) {
          // Only a note that is truly gone is recreated; a network failure
          // leaves the entry for the next launch.
          if (!(error instanceof api.ApiError && error.status === 404)) continue;
        }
        const plan = replayPlan(entry, server);
        if (plan === "drop") {
          outbox.remove(entry.id);
          continue;
        }
        if (plan === "recreate") {
          const { note: created } = await api.createNote();
          await api.saveBody(created.id, entry.body, created.version);
          outbox.remove(entry.id);
          restored += 1;
          continue;
        }
        // An unknown base can only be safe as a conflict. The largest Int the
        // column holds passes validation and never matches a real version.
        versions.current.set(entry.id, entry.base ?? UNKNOWN_BASE);
        liveBody.current.set(entry.id, entry.body);
        setNote((prev) => (prev && prev.id === entry.id ? { ...prev, body: entry.body } : prev));
        queueRef.current(entry.id, entry.body);
        restored += 1;
      }
      if (cancelled) return;
      if (restored > 0) {
        await refreshList().catch(() => undefined);
        toast(`Synced ${restored} ${restored === 1 ? "note" : "notes"} you edited offline.`);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Once per launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- coming back (PRD §4.42) -----------------------------------------------

  // A phone app sits in the background for hours; a laptop tab for days. On
  // return the list and the open note may be stale, and typing into a stale
  // note only to have it become a conflicted copy is the wrong first moment.
  const resync = useCallback(async () => {
    await refreshList().catch(() => undefined);
    // Every note on screen, in every group (§4.81).
    const shown = () => {
      const state = useUiStore.getState();
      return state.splitAvailable ? W.visibleNotes(state.wb) : state.selectedNoteId ? [state.selectedNoteId] : [];
    };
    let changed = false;
    await Promise.all(
      shown().map(async (id) => {
        let loaded: NoteDetail;
        try {
          ({ note: loaded } = await api.fetchNote(id));
        } catch {
          return;
        }
        // The unlock ran out while away: seal the open note now (PRD §4.69).
        if (loaded.sealed && shown().includes(id)) {
          setNote(loaded);
          return;
        }
        // Checked after the fetch too: typing may have started while it ran.
        const adopt =
          shown().includes(id) &&
          shouldAdopt({
            hasUnsaved: unsavedBodyRef.current(id) !== undefined,
            localVersion: versions.current.get(id),
            serverVersion: loaded.version,
          });
        if (!adopt) return;
        if (liveBody.current.get(id) !== loaded.body) changed = true;
        versions.current.set(id, loaded.version);
        liveBody.current.set(id, loaded.body);
        setNote((prev) => (prev && prev.id === id ? loaded : prev));
      }),
    );
    if (changed) toast("Updated with changes from another device.");
  }, [refreshList, setNote]);

  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (shouldResync(hiddenAt, Date.now())) void resync();
      hiddenAt = null;
    };
    const onOnline = () => void resync();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [resync]);

  // --- actions -------------------------------------------------------------

  const createNote = useCallback(
    (options?: { group?: string }) =>
      // Gated: pressing New again while the first is on its way made a note
      // per press.
      gate.run("create", async () => {
        flush();
        await discardFreshIfEmpty();
        const { note: created } = await api.createNote();
        freshNoteId.current = created.id;
        versions.current.set(created.id, created.version);

        if (filter === "trash") setFilter("all");
        setNotes((prev) => [toListItem(created), ...prev]);
        // Into the active group, or the one asked for (§4.81).
        setNote(created);
        liveBody.current.set(created.id, created.body);
        if (options?.group) openNote(created.id, { group: options.group });
        else selectNote(created.id);
      }),
    [discardFreshIfEmpty, filter, flush, gate, openNote, selectNote, setFilter],
  );

  const togglePin = useCallback(
    (target: NoteListItem | NoteDetail) =>
      gate.run(`pin:${target.id}`, async () => {
        const { note: saved } = await api.patchNote(target.id, { pinned: !target.pinned });
        setNote((prev) => (prev && prev.id === saved.id ? { ...saved, body: prev.body } : prev));
        await refreshList();
      }),
    [gate, refreshList],
  );

  /** Archive, colour and template flags (PRD §4.65). */
  const setLabels = useCallback(
    (target: NoteListItem | NoteDetail, patch: LabelPatch): Promise<void> | undefined =>
      gate.run(`label:${target.id}`, async () => {
        if (patch.locked === true) {
          const status = await api.lockStatus();
          if (!status.configured) {
            // First lock: choose the passcode, then lock.
            setPasscodeDialog({ changing: false, scope: target.id, then: () => void setLabelsRef.current(target, patch) });
            return;
          }
        }
        const { note: saved } = await api.patchNote(target.id, patch);
        setNote((prev) => (prev && prev.id === saved.id ? { ...saved, body: prev.body } : prev));
        await refreshList();
        const name = `“${displayTitle(target.title)}”`;
        if (patch.archived !== undefined) {
          toast(patch.archived ? `${name} archived.` : `${name} is back in Notes.`, {
            action: {
              label: "Undo",
              onClick: () => void api.patchNote(target.id, { archived: !patch.archived }).then(() => refreshList()),
            },
          });
        }
        if (patch.template === true) {
          toast(`${name} is now a template.`, { description: "Start a note from it in ⌘K, or from the Templates list." });
        }
        if (patch.locked !== undefined) {
          toast(patch.locked ? `${name} locked.` : `${name} is no longer locked.`, {
            description: patch.locked ? "It stays open here until you lock notes again or 15 minutes pass." : undefined,
          });
        }
      }),
    [gate, refreshList],
  );
  const setLabelsRef = useRef(setLabels);
  setLabelsRef.current = setLabels;

  /**
   * Lock a note again once its last edit has saved (PRD R69.7). Waiting
   * matters: locking first would refuse the save still on its way.
   */
  const relockWhenSaved = useCallback(async (id: string) => {
    const deadline = Date.now() + 20_000;
    while (unsavedBodyRef.current(id) !== undefined && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    await api.lockAction({ action: "lock", scope: id }).catch(() => undefined);
    // Any other group still showing it is sealed too (§4.81).
    setNote((prev) => (prev && prev.id === id && prev.locked ? { ...prev, sealed: true, body: "" } : prev));
  }, [setNote]);

  // Leaving an unlocked locked note locks it; so does switching away from the
  // app, with the note sealed for when you come back.
  const openLocked = useRef<string | null>(null);
  useEffect(() => {
    const previous = openLocked.current;
    if (previous && previous !== selectedNoteId) void relockWhenSaved(previous);
    openLocked.current = null;
  }, [selectedNoteId, relockWhenSaved]);
  useEffect(() => {
    openLocked.current = note && note.locked && !note.sealed ? note.id : null;
  }, [note]);
  useEffect(() => {
    const onVisibility = () => {
      const id = openLocked.current;
      if (document.visibilityState !== "hidden" || !id) return;
      flush();
      void relockWhenSaved(id).then(() => reloadNote(id));
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [flush, relockWhenSaved, reloadNote]);

  /** Lock every note again now (PRD §4.69); the open one is sealed straight away. */
  const lockNow = useCallback(async () => {
    try {
      await api.lockAction({ action: "lock" });
      toast("Locked notes are locked.");
      // Every open locked note is sealed straight away, in every group.
      setNote((prev) => (prev && prev.locked && !prev.sealed ? { ...prev, sealed: true, body: "" } : prev));
    } catch {
      toast.error("Couldn’t lock notes. Try again.");
    }
  }, [setNote]);

  // Templates for ⌘K's "New from …" commands; re-read when the palette opens
  // so a renamed template shows its new name.
  const [templates, setTemplates] = useState<NoteListItem[]>([]);
  useEffect(() => {
    if (!counts.templates) {
      setTemplates([]);
      return;
    }
    let cancelled = false;
    api
      .fetchNotes({ filter: "templates" })
      .then((result) => !cancelled && setTemplates(result.notes))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [counts.templates, paletteOpenNow]);

  const restore = useCallback(
    (target: NoteListItem | NoteDetail) =>
      gate.run(`restore:${target.id}`, async () => {
        await api.restoreNote(target.id);
        await refreshList();
      }),
    [gate, refreshList],
  );

  const trash = useCallback(
    (target: NoteListItem | NoteDetail) =>
      gate.run(`trash:${target.id}`, async () => {
        flush();
        await api.trashNote(target.id);
        // Its tabs close in both panes; the main pane shows the next tab (§4.80).
        closeNoteEverywhere(target.id);
        await refreshList();
        toast(`“${displayTitle(target.title)}” moved to trash.`, {
          action: { label: "Undo", onClick: () => void restore(target) },
        });
      }),
    [closeNoteEverywhere, flush, gate, refreshList, restore],
  );

  const deleteForever = useCallback(
    (target: NoteListItem | NoteDetail) =>
      gate.run(`delete:${target.id}`, async () => {
        await api.deleteNoteForever(target.id);
        closeNoteEverywhere(target.id);
        await refreshList();
        toast(`“${displayTitle(target.title)}” deleted permanently.`);
      }),
    [closeNoteEverywhere, gate, refreshList],
  );

  // --- editor groups and tabs (PRD §4.81) -----------------------------------

  // Tabs and groups need the width of a laptop; a phone shows one note.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 900px)");
    const apply = () => setSplitAvailable(query.matches);
    apply();
    query.addEventListener("change", apply);
    // The saved layout arrives after the first render: show its note then.
    const unsubscribe = useUiStore.persist.onFinishHydration(() => {
      if (useUiStore.getState().splitAvailable) useUiStore.getState().workbench((wb) => wb);
    });
    return () => {
      query.removeEventListener("change", apply);
      unsubscribe();
    };
  }, [setSplitAvailable]);

  /** Titles of notes opened in a tab, for tabs whose note the list is not showing. */
  const seen = useRef(new Map<string, { title: string; locked: boolean }>());
  for (const item of Object.values(loadedNotes)) seen.current.set(item.id, { title: item.title, locked: item.locked });
  const rowsById = useMemo(() => new Map(notes.map((row) => [row.id, row])), [notes]);
  const titleOf = useCallback(
    (id: string) => displayTitle(rowsById.get(id)?.title ?? seen.current.get(id)?.title ?? ""),
    [rowsById],
  );
  const lockedOf = useCallback(
    (id: string) => Boolean(rowsById.get(id)?.locked ?? seen.current.get(id)?.locked),
    [rowsById],
  );

  /** From the note list: a new tab beside the shown one, or Open to the Side. */
  const openIn = useCallback(
    (id: string, where: "tab" | "split") => {
      flush();
      if (where === "tab") openNote(id);
      else workbench((wb) => W.openToSide(wb, id));
    },
    [flush, openNote, workbench],
  );

  /** A list click or a pick from ⌘K opens as a preview, as in VS Code's explorer. */
  const onSelectNote = useCallback(
    (id: string) => {
      flush();
      if (freshNoteId.current && freshNoteId.current !== id) void discardFreshIfEmpty();
      if (useUiStore.getState().splitAvailable) openNote(id, { preview: true });
      else selectNote(id);
    },
    [discardFreshIfEmpty, flush, openNote, selectNote],
  );

  openNoteRef.current = onSelectNote;

  // --- phone back gesture (PRD R26.5) ---------------------------------------

  // On a phone the list and the editor are two screens, but they were one
  // history entry, so the system back gesture left the app. Opening a note on
  // a narrow screen now pushes an entry; going back pops it to the list.
  useEffect(() => {
    if (mobilePane !== "editor") return;
    if (!window.matchMedia("(max-width: 899px)").matches) return;
    if ((window.history.state as { ursaPane?: string } | null)?.ursaPane === "editor") return;
    window.history.pushState({ ...(window.history.state ?? {}), ursaPane: "editor" }, "");
  }, [mobilePane, selectedNoteId]);

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      if ((event.state as { ursaPane?: string } | null)?.ursaPane !== "editor") {
        flush();
        setMobilePane("list");
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [flush, setMobilePane]);

  const backToList = useCallback(() => {
    // Use the history entry when there is one, so the in-app back button and
    // the system gesture leave history in the same state.
    if ((window.history.state as { ursaPane?: string } | null)?.ursaPane === "editor") {
      window.history.back();
    } else {
      setMobilePane("list");
    }
  }, [setMobilePane]);

  // --- edge swipe back (PRD §4.67) -------------------------------------------

  // An app added to an iPhone's home screen has no system back gesture, so the
  // editor offers its own: from the left edge, rightward, the pane follows the
  // finger and letting go past a third of the way returns to the list. Only
  // there — Safari and Android already have a system gesture at that edge.
  const edge = useRef<{ x: number; y: number; dx: number; locked: boolean | null } | null>(null);
  const [edgeShift, setEdgeShift] = useState(0);
  const iosStandalone = useRef(false);
  useEffect(() => {
    iosStandalone.current = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  }, []);
  const edgeHandlers = {
    onTouchStart: (event: React.TouchEvent) => {
      if (!iosStandalone.current || mobilePane !== "editor" || event.touches.length !== 1) return;
      const t = event.touches[0]!;
      if (t.clientX > EDGE_WIDTH) return;
      edge.current = { x: t.clientX, y: t.clientY, dx: 0, locked: null };
    },
    onTouchMove: (event: React.TouchEvent) => {
      const e = edge.current;
      if (!e) return;
      const t = event.touches[0]!;
      const dx = t.clientX - e.x;
      const dy = t.clientY - e.y;
      e.locked ??= Math.abs(dx) > 8 || Math.abs(dy) > 8 ? Math.abs(dx) > Math.abs(dy) : null;
      if (e.locked === false) {
        edge.current = null;
        setEdgeShift(0);
        return;
      }
      e.dx = Math.max(0, dx);
      setEdgeShift(e.dx);
    },
    onTouchEnd: (event: React.TouchEvent) => {
      const e = edge.current;
      edge.current = null;
      if (!e) return;
      const width = (event.currentTarget as HTMLElement).offsetWidth;
      if (edgeBack(e.x, e.dx, 0, width) === "back") {
        haptic();
        backToList();
      }
      setEdgeShift(0);
    },
  };

  // --- links into the app (PRD §4.31) ---------------------------------------

  // A share lands on /?open=<id>; home-screen shortcuts on /?new=1 and
  // /?search=1. Read once on arrival, then removed from the address bar so a
  // reload does not make a second note.
  const intentHandled = useRef(false);
  useEffect(() => {
    if (intentHandled.current) return;
    intentHandled.current = true;
    const params = new URLSearchParams(window.location.search);
    const open = params.get("open");
    const wantsNew = params.get("new") === "1";
    const wantsSearch = params.get("search") === "1";
    const wantsCapture = params.get("capture") === "1";
    if (!open && !wantsNew && !wantsSearch && !wantsCapture) return;
    window.history.replaceState(window.history.state, "", "/");
    if (open) {
      void refreshList();
      selectNote(open);
    } else if (wantsNew) {
      void createNote();
    } else if (wantsCapture) {
      setCaptureOpen(true);
    } else {
      setSearchSignal((n) => n + 1);
    }
  }, [createNote, refreshList, selectNote]);

  // --- keyboard ------------------------------------------------------------

  const focusPane = useCallback(
    (pane: "list" | "editor") => {
      setMobilePane(pane);
      const host = pane === "list" ? listRef.current : editorRef.current;
      // The editor: the active group's, when there are several (§4.81).
      const active = useUiStore.getState().wb.active;
      const target =
        pane === "editor"
          ? (host?.querySelector<HTMLElement>(`[data-ursa-group="${active}"] .cm-content`) ??
            host?.querySelector<HTMLElement>(".cm-content"))
          : host?.querySelector<HTMLElement>("[data-ursa-row]");
      target?.focus();
    },
    [setMobilePane],
  );

  /** Hand the browser a file without routing it through React state. */
  const download = useCallback((href: string, filename: string) => {
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
  }, []);

  const startExport = useCallback(() => {
    download("/api/export", "mdnotes.zip");
    toast("Export started — check your downloads.");
    // An unlock for exporting opens every note: end it once the export is under way.
    setTimeout(() => void api.lockAction({ action: "lock", scope: "all" }).catch(() => undefined), 5000);
  }, [download]);

  /** What to do once "unlock everything" succeeds: the export or backup that asked. */
  const afterUnlockAll = useRef<() => void>(() => undefined);

  /**
   * Locked notes need the passcode before anything carrying every note leaves
   * — a full export, or a backup download (PRD R69.7, §4.77).
   */
  const withEverythingUnlocked = useCallback(async (then: () => void) => {
    try {
      const status = await api.lockStatus();
      if (status.lockedNotes > 0 && !status.unlocked) {
        afterUnlockAll.current = then;
        setUnlockAllOpen(true);
        return;
      }
    } catch {
      // Unknown: let the download itself answer.
    }
    then();
  }, []);

  const exportAll = useCallback(() => withEverythingUnlocked(startExport), [startExport, withEverythingUnlocked]);

  useEffect(() => {
    const onExport = () => void exportAll();
    const onBackup = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      void withEverythingUnlocked(() => {
        download(`/api/backups/${id}`, "mdnotes-backup.zip");
        setTimeout(() => void api.lockAction({ action: "lock", scope: "all" }).catch(() => undefined), 5000);
      });
    };
    window.addEventListener("ursa:export", onExport);
    window.addEventListener("ursa:backup", onBackup);
    return () => {
      window.removeEventListener("ursa:export", onExport);
      window.removeEventListener("ursa:backup", onBackup);
    };
  }, [download, exportAll, withEverythingUnlocked]);

  const exportCurrent = useCallback(() => {
    if (!note) return;
    const url = URL.createObjectURL(new Blob([note.body], { type: "text/markdown" }));
    download(url, `${safeStem(note.title)}.md`);
    // Revoking immediately can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, [download, note]);

  // --- note actions (PRD §4.40) ---------------------------------------------

  /** What the editor shows now — the loaded body can be several keystrokes old. */
  const currentText = useCallback(
    () => (note ? (liveBody.current.get(note.id) ?? note.body) : ""),
    [note],
  );

  const copyMarkdown = useCallback(async () => {
    if (!note) return;
    try {
      await navigator.clipboard.writeText(currentText());
      toast("Copied as Markdown.");
    } catch {
      toast.error("Couldn’t copy — the browser refused clipboard access.");
    }
  }, [currentText, note]);

  /**
   * Rich HTML for editors that take it (Gmail, Docs, Slack), and the HTML
   * source as plain text for those that don't (PRD §4.47).
   */
  const copyHtml = useCallback(async () => {
    if (!note) return;
    const html = markdownToHtml(currentText(), { origin: window.location.origin });
    try {
      if (typeof ClipboardItem === "function" && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([html], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(html);
      }
      toast("Copied as HTML.", { description: "Paste into an email or doc to keep the formatting." });
    } catch {
      toast.error("Couldn’t copy — the browser refused clipboard access.");
    }
  }, [currentText, note]);

  const exportPdf = useCallback(() => {
    if (!note) return;
    printHtml(displayTitle(note.title), markdownToHtml(currentText(), { origin: window.location.origin }));
  }, [currentText, note]);

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const shareNote = useCallback(async () => {
    if (!note) return;
    const text = currentText();
    try {
      await navigator.share({ title: displayTitle(note.title), text });
    } catch (error) {
      // Closing the share sheet is a choice, not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copyMarkdown();
    }
  }, [copyMarkdown, currentText, note]);

  const duplicateNote = useCallback(
    () =>
      note
        ? gate.run(`duplicate:${note.id}`, async () => {
            flush();
            const { note: created } = await api.createNote();
            const result = await api.saveBody(created.id, duplicateBody(currentText()), created.version);
            versions.current.set(created.id, result.note.version);
            if (filter === "trash") setFilter("all");
            await refreshList();
            selectNote(created.id);
            toast("Duplicated — you are in the copy.");
          })
        : undefined,
    [currentText, filter, flush, gate, note, refreshList, selectNote, setFilter],
  );

  /** One action on several notes (PRD §4.66). Each note is its own request; a failure names how many. */
  const bulk = useCallback(
    (ids: string[], action: BulkAction) =>
      gate.run("bulk", async () => {
        if (ids.length === 0) return;
        flush();
        if (action.kind === "delete") {
          const noun = ids.length === 1 ? "note" : "notes";
          if (!window.confirm(`Delete ${ids.length} ${noun} permanently? This cannot be undone.`)) return;
        }
        const one = (id: string): Promise<unknown> => {
          switch (action.kind) {
            case "pin":
              return api.patchNote(id, { pinned: action.pinned });
            case "archive":
              return api.patchNote(id, { archived: action.archived });
            case "color":
              return api.patchNote(id, { color: action.color });
            case "trash":
              return api.trashNote(id);
            case "restore":
              return api.restoreNote(id);
            case "delete":
              return api.deleteNoteForever(id);
          }
        };
        const results = await Promise.allSettled(ids.map(one));
        const failed = results.filter((r) => r.status === "rejected").length;
        if (action.kind === "trash" || action.kind === "delete" || action.kind === "restore") {
          for (const id of ids) closeNoteEverywhere(id);
        }
        await refreshList();
        const done = ids.length - failed;
        const noun = done === 1 ? "note" : "notes";
        const verb =
          action.kind === "pin"
            ? action.pinned ? "Pinned" : "Unpinned"
            : action.kind === "archive"
              ? action.archived ? "Archived" : "Moved back"
              : action.kind === "color"
                ? action.color ? "Labelled" : "Cleared the colour of"
                : action.kind === "trash"
                  ? "Moved to trash"
                  : action.kind === "restore"
                    ? "Restored"
                    : "Deleted";
        const undo =
          action.kind === "trash"
            ? () => void Promise.allSettled(ids.map((id) => api.restoreNote(id))).then(() => refreshList())
            : action.kind === "archive"
              ? () => void Promise.allSettled(ids.map((id) => api.patchNote(id, { archived: !action.archived }))).then(() => refreshList())
              : null;
        toast(`${verb} ${done} ${noun}.`, {
          ...(failed ? { description: `${failed} couldn’t be changed — try those again.` } : {}),
          ...(undo ? { action: { label: "Undo", onClick: undo } } : {}),
        });
      }),
    [closeNoteEverywhere, flush, gate, refreshList],
  );

  /** Quick capture to the Inbox (PRD §4.73). */
  const capture = useCallback(
    async (text: string) => {
      const stamp = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date());
      const { id } = await api.captureToInbox(text, stamp);
      await refreshList().catch(() => undefined);
      // The Inbox open here picks up the new entry.
      if (useUiStore.getState().selectedNoteId === id) void resync();
      toast("Added to Inbox.", {
        action: { label: "Open", onClick: () => openNoteRef.current(id) },
      });
    },
    [refreshList, resync],
  );

  /** The built-in templates, as real templates; ones already there by title are skipped (PRD §4.71). */
  const addStarterTemplates = useCallback(
    () =>
      gate.run("starters", async () => {
        const existing = new Set(
          (await api.fetchNotes({ filter: "templates" })).notes.map((item) => item.title.trim().toLowerCase()),
        );
        let added = 0;
        for (const body of STARTER_TEMPLATES) {
          if (existing.has(starterTitle(body).toLowerCase())) continue;
          const { note: created } = await api.createNote();
          await api.saveBody(created.id, body, created.version);
          await api.patchNote(created.id, { template: true });
          added += 1;
        }
        setFilter("templates");
        await refreshList();
        toast(added ? `Added ${added} starter templates.` : "You already have all the starter templates.", {
          description: added ? "Edit or delete them like any note. Start a note from one in ⌘K." : undefined,
        });
      }),
    [gate, refreshList, setFilter],
  );

  /** A new note from a template, placeholders filled (PRD §4.65). */
  const newFromTemplate = useCallback(
    (template: NoteListItem) =>
      gate.run(`template:${template.id}`, async () => {
        flush();
        const source = template.id === note?.id ? currentText() : (await api.fetchNote(template.id)).note.body;
        const { note: created } = await api.createNote();
        const result = await api.saveBody(created.id, bodyFromTemplate(source, new Date(), deviceTimeZone()), created.version);
        versions.current.set(created.id, result.note.version);
        if (filter !== "all") setFilter("all");
        await refreshList();
        selectNote(created.id);
      }),
    [currentText, filter, flush, gate, note, refreshList, selectNote, setFilter],
  );

  /** Today's note: opened if it exists, otherwise made, from the "Daily note" template if there is one. */
  const openToday = useCallback(
    () =>
      gate.run("today", async () => {
        flush();
        const now = new Date();
        const zone = deviceTimeZone();
        const title = dailyTitle(now, zone);
        const [live, archived] = await Promise.all([
          api.fetchNotes({ filter: "all", query: title }),
          api.fetchNotes({ filter: "archive", query: title }),
        ]);
        const existing = [...live.notes, ...archived.notes].find((item) => item.title === title);
        if (filter !== "all") setFilter("all");
        if (existing) {
          selectNote(existing.id);
          return;
        }
        const daily = templates.find((item) => item.title.trim().toLowerCase() === "daily note");
        const template = daily ? (await api.fetchNote(daily.id)).note.body : null;
        const { note: created } = await api.createNote();
        const result = await api.saveBody(created.id, dailyBody(title, template, now, zone), created.version);
        versions.current.set(created.id, result.note.version);
        await refreshList();
        selectNote(created.id);
      }),
    [filter, flush, gate, refreshList, selectNote, setFilter, templates],
  );

  /**
   * The swipe menu's actions, for any row — not only the open note (PRD
   * §4.52). The open note uses the editor's live text; others are fetched.
   */
  const bodyOf = useCallback(
    async (target: NoteListItem) => {
      if (target.id === note?.id && !note.sealed) return currentText();
      const { note: loaded } = await api.fetchNote(target.id);
      // A locked note's text never leaves it while locked (PRD §4.69).
      if (loaded.sealed) throw new Error("This note is locked — open it and unlock it first.");
      return loaded.body;
    },
    [currentText, note],
  );

  const rowAction = useCallback(
    (target: NoteListItem, kind: "copy" | "share" | "duplicate") => {
      flush();
      if (kind === "copy") {
        // Safari allows a clipboard write only inside the tap itself, so the
        // write starts now with the text still on its way.
        const text = bodyOf(target);
        const write =
          typeof ClipboardItem === "function" && navigator.clipboard.write
            ? navigator.clipboard.write([
                new ClipboardItem({
                  "text/plain": text.then((t) => new Blob([t], { type: "text/plain" })),
                }),
              ])
            : text.then((t) => navigator.clipboard.writeText(t));
        void write.then(
          () => toast("Copied as Markdown."),
          () => toast.error("Couldn’t copy — the browser refused clipboard access."),
        );
        return;
      }
      void gate.run(`${kind}:${target.id}`, async () => {
        const body = await bodyOf(target);
        if (kind === "share") {
          try {
            await navigator.share({ title: displayTitle(target.title), text: body });
          } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") return;
            await navigator.clipboard.writeText(body).then(
              () => toast("Copied as Markdown."),
              () => toast.error("Couldn’t share or copy this note."),
            );
          }
          return;
        }
        const { note: created } = await api.createNote();
        const result = await api.saveBody(created.id, duplicateBody(body), created.version);
        versions.current.set(created.id, result.note.version);
        await refreshList();
        toast(`Duplicated “${displayTitle(target.title)}”.`, {
          action: { label: "Open", onClick: () => openNoteRef.current(created.id) },
        });
      });
    },
    [bodyOf, flush, gate, refreshList],
  );

  /** A tapped #tag searches for it: search is how notes are found (§2). */
  const searchTag = useCallback(
    (tag: string) => {
      flush();
      setQuery(tag);
      setSearchSignal((n) => n + 1);
      setMobilePane("list");
    },
    [flush, setMobilePane, setQuery],
  );

  /**
   * A wiki-link to a note that does not exist is an invitation, not an error
   * (PRD R10.3): offer to create it rather than doing nothing.
   */
  const openWikiLink = useCallback(
    async (title: string) => {
      flush();
      const key = normaliseTitle(title);
      const existing = notes.find((row) => normaliseTitle(row.title) === key);
      if (existing) {
        selectNote(existing.id);
        return;
      }

      try {
        const { resolved } = (await api.resolveWikiLinks([title])) as {
          resolved: Record<string, string>;
        };
        const id = resolved[key];
        if (id) {
          selectNote(id);
          return;
        }
      } catch {
        // Fall through to offering creation.
      }

      toast(`No note called “${title}”.`, {
        action: {
          label: "Create it",
          onClick: () => {
            void gate.run(`link:${normaliseTitle(title)}`, async () => {
              const { note: created } = await api.createNote();
              const result = await api.saveBody(created.id, `# ${title}\n\n`, created.version);
              versions.current.set(created.id, result.note.version);
              await refreshList();
              selectNote(created.id);
            });
          },
        },
      });
    },
    [flush, gate, notes, refreshList, selectNote],
  );

  /** Permanent and irreversible, so it states the number first (PRD R12.2). */
  const confirmEmptyTrash = useCallback(() => {
    const count = counts.trash;
    if (count === 0) return;
    const noun = count === 1 ? "note" : "notes";
    if (!window.confirm(`Permanently delete ${count} ${noun} in Trash? This cannot be undone.`)) {
      return;
    }
    void gate.run("empty-trash", async () => {
      const { deleted } = await api.emptyTrash();
      // Tabs of the notes that were in the trash close (§4.81).
      for (const item of Object.values(loadedNotesRef.current)) if (item.deletedAt) closeNoteEverywhere(item.id);
      await refreshList();
      toast(`Deleted ${deleted} ${deleted === 1 ? "note" : "notes"}.`);
    });
  }, [closeNoteEverywhere, counts.trash, gate, refreshList]);

  // --- history (PRD §4.28) --------------------------------------------------

  const openHistory = useCallback(() => {
    // Send anything unsaved first, so the newest text is what versions are
    // compared against and, if it qualifies, kept.
    flush();
    setHistoryOpen(true);
  }, [flush]);

  const onRestored = useCallback(
    (restored: NoteDetail) => {
      // Restoring is an explicit choice: typing not yet sent for this note
      // was built on the text being replaced, so it is dropped rather than
      // saved over the restore. A save already in flight carries the old
      // version and becomes a conflicted copy, never an overwrite.
      takePending(restored.id);
      liveBody.current.set(restored.id, restored.body);
      versions.current.set(restored.id, restored.version);
      setNote((prev) => (prev && prev.id === restored.id ? restored : prev));
      setNotes((prev) => prev.map((row) => (row.id === restored.id ? toListItem(restored) : row)));
    },
    [takePending],
  );

  /** The palette's group commands depend on the layout (§4.81). */
  const wbNow = useUiStore((state) => state.wb);
  const commands = useMemo<Command[]>(() => {
    const themeCommands: Command[] = THEMES.map((option) => ({
      id: `theme:${option.value}`,
      label: `Theme: ${option.label}`,
      run: () => setTheme(option.value),
    }));

    return [
      { id: "new", label: "New note", hint: "⌘N", run: () => void createNote() },
      ...(splitAvailable ? workbenchCommands(workbench) : []),
      { id: "today", label: "Open today’s note", run: () => void openToday() },
      { id: "capture", label: "Quick note to Inbox", hint: "⌘⇧Space", run: () => setCaptureOpen(true) },
      ...templates.map((template) => ({
        id: `template:${template.id}`,
        label: `New from template: ${displayTitle(template.title)}`,
        run: () => void newFromTemplate(template),
      })),
      { id: "lock-now", label: "Lock locked notes now", run: () => void lockNow() },
      {
        id: "passcode",
        label: "Set or change the note passcode",
        run: () =>
          void api
            .lockStatus()
            .then((status) => setPasscodeDialog({ changing: status.configured }))
            .catch(() => toast.error("Couldn’t reach the server.")),
      },
      ...(note && !note.deletedAt
        ? [{ id: "lock-toggle", label: note.locked ? "Remove lock from note" : "Lock note", run: () => void setLabels(note, { locked: !note.locked }) }]
        : []),
      { id: "filter-archive", label: "Show archived notes", run: () => setFilter("archive") },
      { id: "filter-templates", label: "Show templates", run: () => setFilter("templates") },
      { id: "starters", label: "Add starter templates (meeting, weekly review, packing…)", run: () => void addStarterTemplates() },
      ...(note && !note.deletedAt
        ? [
            {
              id: "archive",
              label: note.archivedAt ? "Move note back to Notes" : "Archive note",
              run: () => void setLabels(note, { archived: !note.archivedAt }),
            },
            {
              id: "template-flag",
              label: note.isTemplate ? "Stop using note as a template" : "Save note as template",
              run: () => void setLabels(note, { template: !note.isTemplate }),
            },
            ...NOTE_COLORS.map((color) => ({
              id: `color:${color}`,
              label: `Colour label: ${COLOR_LABEL[color]}`,
              run: () => void setLabels(note, { color }),
            })),
            ...(note.color ? [{ id: "color:none", label: "Remove colour label", run: () => void setLabels(note, { color: null }) }] : []),
          ]
        : []),
      {
        id: "focus",
        label: focusMode ? "Exit focus mode" : "Focus mode",
        hint: "⌘.",
        run: toggleFocusMode,
      },
      { id: "appearance", label: "Appearance…", run: () => setSettingsOpen(true) },
      { id: "export-all", label: "Export all notes (.zip)", run: () => void exportAll() },
      { id: "shortcuts", label: "Keyboard shortcuts", hint: "⌘/", run: () => setShortcutsOpen(true) },
      { id: "outline", label: "Toggle outline", hint: "⌘⇧O", run: toggleOutline },
      { id: "typewriter", label: "Toggle typewriter scrolling (keep the line centred)", run: () => { const st = useUiStore.getState(); st.setTypewriterMode(!st.typewriterMode); } },
      { id: "focus-dim", label: "Toggle focus dimming (fade other paragraphs)", run: () => useUiStore.getState().toggleFocusDim() },
      { id: "reading", label: "Toggle reading mode", run: () => useUiStore.getState().toggleReadingMode() },
      {
        id: "privacy",
        label: "Hide or show note titles (screen sharing)",
        hint: "⌘⇧L",
        run: () => useUiStore.getState().togglePrivacyMode(),
      },
      {
        id: "auto-privacy",
        label: "Hide titles when I leave the tab: on or off",
        run: () => {
          const state = useUiStore.getState();
          state.setAutoPrivacy(!state.autoPrivacy);
          toast(state.autoPrivacy ? "Titles stay visible when you leave the tab." : "Titles hide whenever you leave the tab.");
        },
      },
      ...(counts.trash > 0
        ? [{ id: "empty-trash", label: `Empty trash (${counts.trash})`, run: confirmEmptyTrash }]
        : []),
      ...(note ? [{ id: "export-one", label: "Export this note (.md)", run: exportCurrent }] : []),
      ...(note ? [{ id: "history", label: "Note history…", run: openHistory }] : []),
      ...(note
        ? [
            { id: "duplicate", label: "Duplicate note", run: () => void duplicateNote() },
            { id: "copy-md", label: "Copy note as Markdown", run: () => void copyMarkdown() },
            { id: "copy-html", label: "Copy note as HTML", run: () => void copyHtml() },
            { id: "pdf", label: "Export note as PDF", run: exportPdf },
          ]
        : []),
      ...(installMode !== "installed"
        ? [{ id: "install", label: "Install mdNotes as an app", run: () => void installApp() }]
        : []),
      ...(note && !note.deletedAt
        ? [
            {
              id: "pin",
              label: note.pinned ? "Unpin note" : "Pin note",
              hint: "⌘P",
              run: () => void togglePin(note),
            },
            { id: "trash", label: "Move note to trash", hint: "⌘⌫", run: () => void trash(note) },
          ]
        : []),
      ...themeCommands,
    ];
  }, [wbNow, splitAvailable, workbench, addStarterTemplates, lockNow, openToday, templates, newFromTemplate, setLabels, setFilter, confirmEmptyTrash, copyHtml, exportPdf, copyMarkdown, counts.trash, createNote, duplicateNote, exportAll, exportCurrent, focusMode, installMode, note, openHistory, setSettingsOpen, setShortcutsOpen, setTheme, toggleFocusMode, toggleOutline, togglePin, trash]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;

      switch (event.key) {
        case "k":
          event.preventDefault();
          setPaletteOpen(!useUiStore.getState().paletteOpen);
          return;
        case "o":
          if (event.shiftKey) {
            event.preventDefault();
            toggleOutline();
            return;
          }
          return;
        case "O":
          event.preventDefault();
          toggleOutline();
          return;
        case " ":
          // ⌘⇧Space: quick note to the Inbox (PRD §4.73).
          if (event.shiftKey) {
            event.preventDefault();
            setCaptureOpen(true);
          }
          return;
        case "l":
        case "L":
          // ⌘⇧L: blur titles for screen sharing (PRD §4.59).
          if (event.shiftKey) {
            event.preventDefault();
            useUiStore.getState().togglePrivacyMode();
          }
          return;
        case "/":
          event.preventDefault();
          setShortcutsOpen(!useUiStore.getState().shortcutsOpen);
          return;
        case "n":
          event.preventDefault();
          void createNote();
          return;
        case ".":
          event.preventDefault();
          toggleFocusMode();
          return;
        case "1":
          // On a phone (no groups): ⌘1 the list, ⌘2 the note, as before.
          if (useUiStore.getState().splitAvailable) return;
          event.preventDefault();
          focusPane("list");
          return;
        case "2":
          if (useUiStore.getState().splitAvailable) return;
          event.preventDefault();
          focusPane("editor");
          return;
        case "p":
          if (note) {
            event.preventDefault();
            void togglePin(note);
          }
          return;
        case "Backspace": {
          // ⌘⌫ is delete-to-start-of-line while writing. Trashing the note out
          // from under that is the most alarming thing the app could do.
          const inEditor = document.activeElement?.closest(".cm-content") != null;
          if (inEditor) return;
          if (note && !note.deletedAt) {
            event.preventDefault();
            void trash(note);
          }
          return;
        }
        default:
          return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createNote, focusPane, note, setPaletteOpen, setShortcutsOpen, toggleFocusMode, toggleOutline, togglePin, trash]);

  // VS Code's editor-group keys (§4.81), ahead of everything else so ⌘K's
  // chords reach here before the palette's input does.
  useEffect(() => {
    const mac = isMac();
    let chordUntil = 0;
    const focusEditorSoon = () =>
      requestAnimationFrame(() => {
        const active = useUiStore.getState().wb.active;
        document.querySelector<HTMLElement>(`[data-ursa-group="${active}"] .cm-content`)?.focus();
      });
    const act = (action: (wb: W.Workbench) => W.Workbench, focus = true) => {
      flush();
      workbench(action);
      if (focus) focusEditorSoon();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!useUiStore.getState().splitAvailable) return;
      if (["Meta", "Control", "Alt", "Shift"].includes(event.key)) return;

      if (chordUntil > Date.now()) {
        chordUntil = 0;
        const chord = chordAction(event, mac);
        if (chord) {
          event.preventDefault();
          event.stopPropagation();
          setPaletteOpen(false);
          const wb = useUiStore.getState().wb;
          const group = wb.active;
          const shown = W.shownNote(wb);
          switch (chord.kind) {
            case "splitDown":
              return act((w) => W.split(w, group, "down", { note: shown ?? undefined }));
            case "closeAllInGroup":
              return act((w) => W.closeAllInGroup(w, group));
            case "closeAll":
              return act(W.closeAllGroups);
            case "maximize":
              return act((w) => W.toggleMaximize(w, group));
            case "keepOpen":
              return shown ? act((w) => W.keepTab(w, group, shown)) : undefined;
            case "togglePin":
              if (!shown) return;
              return act((w) =>
                W.activeGroup(w).pinned.includes(shown) ? W.unpinTab(w, group, shown) : W.pinTab(w, group, shown),
              );
            case "focusSide":
              return act((w) => W.focusSide(w, chord.side));
          }
        }
      }

      const action = keyAction(event, mac);
      if (!action) return;
      const wb = useUiStore.getState().wb;
      const group = wb.active;
      const shown = W.shownNote(wb);
      // ⌘K still opens the palette (the listener below); it also starts a chord.
      if (action.kind === "startChord") {
        chordUntil = Date.now() + 2000;
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      switch (action.kind) {
        case "splitRight":
          return act((w) => W.split(w, group, "right", { note: shown ?? undefined }));
        case "splitDown":
          return act((w) => W.split(w, group, "down", { note: shown ?? undefined }));
        case "focusList":
          return focusPane("list");
        case "focusGroup":
          return act((w) => W.focusGroupAt(w, action.n));
        case "tabAt":
          return act((w) => W.tabAt(w, action.n));
        case "nextTab":
          return act((w) => W.step(w, 1));
        case "previousTab":
          return act((w) => W.step(w, -1));
        case "closeTab":
          return shown ? act((w) => W.closeTab(w, group, shown)) : undefined;
        case "reopenTab":
          return act((w) => W.reopenClosed(w));
        case "moveToNextGroup":
        case "moveToPreviousGroup": {
          if (!shown) return;
          const offset = action.kind === "moveToNextGroup" ? 1 : -1;
          const target = W.adjacentGroup(wb, group, offset);
          return act((w) =>
            target ? W.moveTab(w, group, shown, target) : W.split(w, group, offset === 1 ? "right" : "left", { note: shown, move: true }),
          );
        }
        case "flipLayout":
          return act(W.flipLayout, false);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [flush, focusPane, setPaletteOpen, workbench]);

  // --- editor panes (PRD §4.81) ---------------------------------------------

  /** What each group last showed, kept on screen (dimmed) while its next note loads. */
  const lastShown = useRef(new Map<string, NoteDetail>());

  /**
   * One note pane. Every group gets the full pane; its actions work on `note`,
   * the active group's, and a click anywhere in a group makes it active first.
   */
  const paneFor = (shown: NoteDetail | null, group: string | null, active: boolean, chrome = true) => {
    const id = shown?.id ?? (group ? useUiStore.getState().wb.groups[group]?.active : selectedNoteId) ?? null;
    return (
      <EditorPane
        note={shown}
        active={active}
        chrome={chrome}
        saveStatus={status}
        onChange={onBodyChange}
        onBlur={() => {
          flush();
          void discardFreshIfEmpty();
        }}
        onWikiLink={(title) => void openWikiLink(title)}
        onTogglePin={() => note && void togglePin(note)}
        onTrash={() => note && void trash(note)}
        onRestore={() => note && void restore(note)}
        onBack={backToList}
        onOpenNote={onSelectNote}
        pending={pending}
        loading={id ? loadingIds.has(id) : false}
        onHistory={openHistory}
        onCreate={() => void createNote(group ? { group } : undefined)}
        onDuplicate={() => void duplicateNote()}
        onCopy={() => void copyMarkdown()}
        onCopyHtml={() => void copyHtml()}
        onPdf={exportPdf}
        onLabels={(patch) => note && void setLabels(note, patch)}
        onUseTemplate={() => note && void newFromTemplate(note)}
        onShareLink={() => setShareLinkOpen(true)}
        onUnlocked={() => id && reloadNote(id)}
        onShare={canShare ? () => void shareNote() : undefined}
        onDownload={exportCurrent}
        onTag={searchTag}
        loadError={id ? (loadErrors[id] ?? null) : null}
        onRetry={() => id && reloadNote(id)}
        highlight={active ? debouncedQuery : ""}
      />
    );
  };

  const renderGroup = (group: Group, active: boolean, corner: boolean) => {
    let shown = group.active ? (loadedNotes[group.active] ?? null) : null;
    if (shown) lastShown.current.set(group.id, shown);
    else if (group.active && loadingIds.has(group.active)) shown = lastShown.current.get(group.id) ?? null;
    // A locked note stays readable only in the group being used; elsewhere it
    // shows sealed until that group is clicked (PRD §4.69).
    if (shown && shown.locked && !active) shown = { ...shown, sealed: true, body: "" };
    return paneFor(shown, group.id, active, corner);
  };

  // A phone shows one note; the last one stays (dimmed) while the next loads.
  if (note) lastShown.current.set("", note);
  const phoneNote = note ?? (noteLoading ? (lastShown.current.get("") ?? null) : null);

  const tabInfo: TabInfo = {
    titleOf,
    lockedOf,
    dirtyOf: (id) => unsavedBody(id) !== undefined,
    onNewNote: (group) => void createNote({ group }),
    onCopyLink: (id) => {
      void navigator.clipboard
        .writeText(`[[${titleOf(id)}]]`)
        .then(() => toast("Link copied. Paste it into another note."))
        .catch(() => toast.error("Couldn’t copy the link."));
    },
  };

  // --- layout --------------------------------------------------------------
  // Container queries, not viewport media queries, so the shell stays correct
  // if it is ever embedded in something narrower than the window.

  const listHidden = focusMode || mobilePane !== "list";

  return (
    <ClockProvider initial={initialClock}>
    <div className="ursa-shell @container flex h-dvh w-full overflow-hidden">
      <div
        ref={listRef}
        style={{ "--pane": `${listWidth}px` } as React.CSSProperties}
        className={`ursa-pane-list ${mobilePane === "list" ? "flex" : "hidden"} w-full flex-none flex-col ${
          focusMode ? "@[900px]:hidden" : "@[900px]:flex @[900px]:w-[var(--pane)]"
        }`}
      >
        <NoteList
          notes={notes}
          counts={counts}
          filter={filter}
          query={query}
          selectedNoteId={selectedNoteId}
          loading={loading}
          onFilterChange={setFilter}
          onQueryChange={setQuery}
          onSelect={onSelectNote}
          onTogglePin={(target) => void togglePin(target)}
          onTrash={(target) => void trash(target)}
          onRestore={(target) => void restore(target)}
          onDeleteForever={(target) => void deleteForever(target)}
          onRowAction={rowAction}
          onOpenIn={splitAvailable ? openIn : undefined}
          canShare={canShare}
          onCreate={() => void createNote()}
          onEmptyTrash={confirmEmptyTrash}
          onToday={() => void openToday()}
          onAddStarters={() => void addStarterTemplates()}
          onArchive={(target) => void setLabels(target, { archived: !target.archivedAt })}
          onTag={searchTag}
          onBulk={(ids, action) => void bulk(ids, action)}
          onRefresh={resync}
          pending={pending}
          searchSignal={searchSignal}
        />
      </div>

      {!focusMode && (
        <div className="hidden @[900px]:flex">
          <PaneDivider
            width={listWidth}
            min={LIST_BOUNDS.min}
            max={LIST_BOUNDS.max}
            label="Resize note list"
            onResize={setListWidth}
          />
        </div>
      )}

      <div
        ref={editorRef}
        {...edgeHandlers}
        onTouchCancel={edgeHandlers.onTouchEnd}
        style={edgeShift ? { transform: `translateX(${edgeShift}px)`, transition: "none" } : undefined}
        className={`ursa-pane-editor transition-transform duration-200 ${
          mobilePane === "editor" ? "flex" : "hidden"
        } min-w-0 flex-1 @[900px]:flex @[900px]:min-w-[420px]`}
      >
        <div className="min-h-0 min-w-0 flex-1">
          {splitAvailable ? <Workbench info={tabInfo} renderGroup={renderGroup} /> : paneFor(phoneNote, null, true)}
        </div>
      </div>

      <PasscodeDialog
        open={passcodeDialog !== null}
        changing={passcodeDialog?.changing ?? false}
        scope={passcodeDialog?.scope}
        onOpenChange={(open) => !open && setPasscodeDialog(null)}
        onDone={() => {
          const then = passcodeDialog?.then;
          setPasscodeDialog(null);
          toast("Passcode saved.");
          then?.();
        }}
      />

      <QuickCapture open={captureOpen} onOpenChange={setCaptureOpen} onSave={capture} />

      <UnlockAllDialog open={unlockAllOpen} onOpenChange={setUnlockAllOpen} onUnlocked={() => afterUnlockAll.current()} />

      <ShareLinkDialog
        noteId={note?.id ?? null}
        locked={Boolean(note?.locked)}
        open={shareLinkOpen}
        onOpenChange={setShareLinkOpen}
      />

      {/* Focus mode hides the list entirely, so leave a way back to it. */}
      {listHidden && focusMode && (
        <button
          type="button"
          onClick={toggleFocusMode}
          aria-label="Show note list (⌘.)"
          title="Show note list (⌘.)"
          className="fixed bottom-4 left-4 z-20 rounded-full border border-border bg-raised px-3 py-1.5 text-[0.72rem] text-ink-soft shadow-lg hover:text-ink"
        >
          ☰ Notes
        </button>
      )}

      <CommandPalette
        open={paletteOpen}
        notes={notes}
        recent={recentNotes(recentIds, notes, selectedNoteId)}
        commands={commands}
        onSelectNote={onSelectNote}
        onOpenChange={setPaletteOpen}
      />

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <HistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        noteId={note?.id ?? null}
        currentBody={note ? (liveBody.current.get(note.id) ?? note.body) : ""}
        onRestored={onRestored}
      />

      {!online && (
        <div
          role="status"
          data-ursa-offline-banner=""
          className="ursa-fade-in pointer-events-none fixed left-1/2 top-[calc(0.5rem+env(safe-area-inset-top))] z-50 -translate-x-1/2 rounded-full border border-border bg-raised/95 px-3 py-1 text-[0.72rem] text-ink-soft shadow-[var(--shadow)] backdrop-blur"
        >
          Offline — showing what this device last saw. Edits will sync.
        </div>
      )}

      <Toaster position="bottom-center" />
    </div>
    </ClockProvider>
  );
}

/** The editor-group commands for ⌘K (PRD §4.81), named as in VS Code. */
function workbenchCommands(workbench: (action: (wb: W.Workbench) => W.Workbench) => void): Command[] {
  const wb = useUiStore.getState().wb;
  const group = wb.active;
  const shown = W.shownNote(wb);
  const g = W.activeGroup(wb);
  const many = Object.keys(wb.groups).length > 1;
  const on = (action: (w: W.Workbench) => W.Workbench) => () => workbench(action);
  const commands: Command[] = [
    { id: "wb-split-right", label: "Split Editor Right", hint: "⌘\\", run: on((w) => W.split(w, group, "right", { note: shown ?? undefined })) },
    { id: "wb-split-down", label: "Split Editor Down", hint: "⌘K ⌘\\", run: on((w) => W.split(w, group, "down", { note: shown ?? undefined })) },
    { id: "wb-split-left", label: "Split Editor Left", run: on((w) => W.split(w, group, "left", { note: shown ?? undefined })) },
    { id: "wb-split-up", label: "Split Editor Up", run: on((w) => W.split(w, group, "up", { note: shown ?? undefined })) },
    { id: "wb-reopen", label: "Reopen Closed Tab", hint: "⌥⇧T", run: on((w) => W.reopenClosed(w)) },
    { id: "wb-close-group-tabs", label: "Close All Tabs in Group", run: on((w) => W.closeAllInGroup(w, group)) },
    { id: "wb-close-all", label: "Close All Tabs", hint: "⌘K ⌘W", run: on(W.closeAllGroups) },
    { id: "wb-next-tab", label: "Next Tab", hint: "⌃PageDown", run: on((w) => W.step(w, 1)) },
    { id: "wb-previous-tab", label: "Previous Tab", hint: "⌃PageUp", run: on((w) => W.step(w, -1)) },
    { id: "wb-lock", label: g.locked ? "Unlock Group" : "Lock Group", run: on((w) => W.toggleLock(w, group)) },
    { id: "wb-flip", label: "Flip Editor Layout", hint: "⌥⌘0", run: on(W.flipLayout) },
    ...PRESETS.map((preset) => ({
      id: `wb-layout-${preset.value}`,
      label: `Editor Layout: ${preset.label}`,
      run: on((w) => W.applyPreset(w, preset.value)),
    })),
  ];
  if (shown) {
    commands.push(
      { id: "wb-close-tab", label: "Close Tab", hint: "⌥W", run: on((w) => W.closeTab(w, group, shown)) },
      { id: "wb-close-others", label: "Close Other Tabs", run: on((w) => W.closeOthers(w, group, shown)) },
      { id: "wb-close-right", label: "Close Tabs to the Right", run: on((w) => W.closeToRight(w, group, shown)) },
      g.pinned.includes(shown)
        ? { id: "wb-unpin", label: "Unpin Tab", hint: "⌘K ⇧⏎", run: on((w) => W.unpinTab(w, group, shown)) }
        : { id: "wb-pin", label: "Pin Tab", hint: "⌘K ⇧⏎", run: on((w) => W.pinTab(w, group, shown)) },
      { id: "wb-move-next", label: "Move Tab into Next Group", hint: "⌃⌘→", run: on((w) => W.sendTab(w, group, shown, "right")) },
      { id: "wb-move-previous", label: "Move Tab into Previous Group", hint: "⌃⌘←", run: on((w) => W.sendTab(w, group, shown, "left")) },
      { id: "wb-move-below", label: "Move Tab into Group Below", run: on((w) => W.sendTab(w, group, shown, "down")) },
      { id: "wb-move-above", label: "Move Tab into Group Above", run: on((w) => W.sendTab(w, group, shown, "up")) },
    );
    if (g.preview === shown) commands.push({ id: "wb-keep", label: "Keep Tab Open", hint: "⌘K ⏎", run: on((w) => W.keepTab(w, group, shown)) });
  }
  if (many) {
    commands.push(
      { id: "wb-maximize", label: wb.maximized ? "Restore Group Sizes" : "Maximize Group", hint: "⌘K ⌘M", run: on((w) => W.toggleMaximize(w, group)) },
      { id: "wb-even", label: "Make Groups Even", run: on(W.even) },
      { id: "wb-join", label: "Join Group with Next Group", run: on((w) => W.joinGroup(w, group)) },
      { id: "wb-join-all", label: "Join All Groups", run: on(W.joinAll) },
      { id: "wb-close-group", label: "Close Group", run: on((w) => W.closeGroup(w, group)) },
      { id: "wb-focus-left", label: "Focus Left Group", hint: "⌘K ⌘←", run: on((w) => W.focusSide(w, "left")) },
      { id: "wb-focus-right", label: "Focus Right Group", hint: "⌘K ⌘→", run: on((w) => W.focusSide(w, "right")) },
      { id: "wb-focus-up", label: "Focus Group Above", hint: "⌘K ⌘↑", run: on((w) => W.focusSide(w, "up")) },
      { id: "wb-focus-down", label: "Focus Group Below", hint: "⌘K ⌘↓", run: on((w) => W.focusSide(w, "down")) },
    );
  }
  return commands;
}

function toListItem(note: NoteDetail): NoteListItem {
  const { body: _body, createdAt: _createdAt, ...row } = note;
  return row;
}
