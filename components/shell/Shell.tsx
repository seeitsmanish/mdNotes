"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "@/lib/api";
import { useAutosave } from "@/components/editor/useAutosave";
import { displayTitle } from "@/lib/markdown/derive";
import { safeStem } from "@/lib/export/filename";
import { normaliseTitle } from "@/lib/markdown/wikilink";
import { conflictCopyBody } from "@/lib/notes/conflict";
import { duplicateBody } from "@/lib/notes/duplicate";
import { markdownToHtml } from "@/lib/export/toHtml";
import { shouldAdopt, shouldResync } from "@/lib/notes/resync";
import { LIST_BOUNDS, THEMES, type SyncedSettings, useUiStore } from "@/lib/store/useUiStore";
import { useSettingsSync } from "@/lib/store/useSettingsSync";
import type { Clock } from "@/lib/clock";
import type { NoteCounts, NoteDetail, NoteListItem } from "@/lib/types";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { applyAppearance } from "@/lib/theme";
import { CommandPalette, type Command } from "./CommandPalette";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { HistoryDialog } from "./HistoryDialog";
import { createGate } from "@/lib/async/gate";
import { installApp, registerServiceWorker, useInstallMode } from "@/lib/pwa/install";
import { installGlobalReporting, reportError } from "@/lib/report/client";
import { ClockProvider } from "./ClockProvider";
import { EditorPane } from "./EditorPane";
import { NoteList } from "./NoteList";
import { PaneDivider } from "./PaneDivider";

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

export function Shell({ initialNotes, initialCounts, initialSettings, initialClock }: ShellProps) {
  const filter = useUiStore((state) => state.filter);
  const setFilter = useUiStore((state) => state.setFilter);
  const query = useUiStore((state) => state.query);
  const setQuery = useUiStore((state) => state.setQuery);
  const selectedNoteId = useUiStore((state) => state.selectedNoteId);
  const selectNote = useUiStore((state) => state.selectNote);
  const mobilePane = useUiStore((state) => state.mobilePane);
  const setMobilePane = useUiStore((state) => state.setMobilePane);
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
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [loading, setLoading] = useState(false);
  /**
   * The editor's latest text per note. A ref, not state: it changes on every
   * keystroke and only matters when something needs "what is in the editor
   * now" — the history dialog's comparison (PRD §4.28). `note.body` is the
   * text as loaded, which goes stale as soon as you type.
   */
  const liveBody = useRef(new Map<string, string>());

  const [historyOpen, setHistoryOpen] = useState(false);
  /** A note is being fetched after a switch (PRD §4.25). */
  const [noteLoading, setNoteLoading] = useState(false);
  // A note that failed to open says so, with Retry, instead of silently
  // showing the empty "Pick a note" screen (PRD R25.5).
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteReload, setNoteReload] = useState(0);

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
    const result = await api.fetchNotes({ filter, query: debouncedQuery });
    setNotes(result.notes);
    setCounts(result.counts);
    return result.notes;
  }, [debouncedQuery, filter]);

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

  useEffect(() => {
    setNoteError(null);
    if (!selectedNoteId) {
      setNote(null);
      return;
    }

    // A superseded request must not land after the one that replaced it.
    const controller = new AbortController();
    let cancelled = false;
    setNoteLoading(true);

    // One quiet retry: a request cut off by the browser (Safari's Esc stops
    // loading) or a blip on a phone network should not lose the note.
    const load = () =>
      api.fetchNote(selectedNoteId, controller.signal).catch(async (error: unknown) => {
        if (controller.signal.aborted) throw error;
        await new Promise((resolve) => setTimeout(resolve, 400));
        return api.fetchNote(selectedNoteId, controller.signal);
      });
    load()
      .then(({ note: loaded }) => {
        if (cancelled) return;
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
        if (cancelled) return;
        setNote(null);
        setNoteError(error instanceof Error ? error.message : "Couldn’t open this note.");
      })
      .finally(() => {
        if (!cancelled) setNoteLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedNoteId, noteReload]);

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

  const onConflict = useCallback((id: string, current: NoteDetail, copy: NoteDetail) => {
    versions.current.set(id, current.version);
    versions.current.set(copy.id, copy.version);

    // Anything typed while the losing save was in flight was built on the
    // losing text too, so it follows that text to the copy (R18.4).
    const newer = takePendingRef.current(id);
    if (newer !== undefined) queueRef.current(copy.id, conflictCopyBody(newer));

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
      [onConflict],
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
      if (freshNoteId.current === id && body.length > 0) freshNoteId.current = null;
      queue(id, body);
    },
    [queue],
  );

  const discardFreshIfEmpty = useCallback(async () => {
    const id = freshNoteId.current;
    if (!id) return;
    freshNoteId.current = null;
    try {
      await api.deleteNoteForever(id);
      setNotes((prev) => prev.filter((row) => row.id !== id));
      if (useUiStore.getState().selectedNoteId === id) selectNote(null);
    } catch {
      // A failed cleanup is harmless — the note stays as an empty row.
    }
  }, [selectNote]);

  // --- coming back (PRD §4.42) -----------------------------------------------

  // A phone app sits in the background for hours; a laptop tab for days. On
  // return the list and the open note may be stale, and typing into a stale
  // note only to have it become a conflicted copy is the wrong first moment.
  const resync = useCallback(async () => {
    await refreshList().catch(() => undefined);
    const id = useUiStore.getState().selectedNoteId;
    if (!id) return;
    let loaded: NoteDetail;
    try {
      ({ note: loaded } = await api.fetchNote(id));
    } catch {
      return;
    }
    // Checked after the fetch too: typing may have started while it ran.
    const adopt =
      useUiStore.getState().selectedNoteId === id &&
      shouldAdopt({
        hasUnsaved: unsavedBodyRef.current(id) !== undefined,
        localVersion: versions.current.get(id),
        serverVersion: loaded.version,
      });
    if (!adopt) return;
    const changed = liveBody.current.get(id) !== loaded.body;
    versions.current.set(id, loaded.version);
    liveBody.current.set(id, loaded.body);
    setNote((prev) => (prev && prev.id === id ? loaded : prev));
    if (changed) toast("Updated with changes from another device.");
  }, [refreshList]);

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
    () =>
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
        setNote(created);
        selectNote(created.id);
      }),
    [discardFreshIfEmpty, filter, flush, gate, selectNote, setFilter],
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
        if (useUiStore.getState().selectedNoteId === target.id) selectNote(null);
        await refreshList();
        toast(`“${displayTitle(target.title)}” moved to trash.`, {
          action: { label: "Undo", onClick: () => void restore(target) },
        });
      }),
    [flush, gate, refreshList, restore, selectNote],
  );

  const deleteForever = useCallback(
    (target: NoteListItem | NoteDetail) =>
      gate.run(`delete:${target.id}`, async () => {
        await api.deleteNoteForever(target.id);
        if (useUiStore.getState().selectedNoteId === target.id) selectNote(null);
        await refreshList();
        toast(`“${displayTitle(target.title)}” deleted permanently.`);
      }),
    [gate, refreshList, selectNote],
  );

  const onSelectNote = useCallback(
    (id: string) => {
      flush();
      if (freshNoteId.current && freshNoteId.current !== id) void discardFreshIfEmpty();
      selectNote(id);
    },
    [discardFreshIfEmpty, flush, selectNote],
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
    if (!open && !wantsNew && !wantsSearch) return;
    window.history.replaceState(window.history.state, "", "/");
    if (open) {
      void refreshList();
      selectNote(open);
    } else if (wantsNew) {
      void createNote();
    } else {
      setSearchSignal((n) => n + 1);
    }
  }, [createNote, refreshList, selectNote]);

  // --- keyboard ------------------------------------------------------------

  const focusPane = useCallback(
    (pane: "list" | "editor") => {
      setMobilePane(pane);
      const host = pane === "list" ? listRef.current : editorRef.current;
      const target =
        pane === "editor"
          ? host?.querySelector<HTMLElement>(".cm-content")
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

  const exportAll = useCallback(() => {
    download("/api/export", "ursa-notes.zip");
    toast("Export started — check your downloads.");
  }, [download]);

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
      if (selectedNoteId) selectNote(null);
      await refreshList();
      toast(`Deleted ${deleted} ${deleted === 1 ? "note" : "notes"}.`);
    });
  }, [counts.trash, gate, refreshList, selectNote, selectedNoteId]);

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

  const commands = useMemo<Command[]>(() => {
    const themeCommands: Command[] = THEMES.map((option) => ({
      id: `theme:${option.value}`,
      label: `Theme: ${option.label}`,
      run: () => setTheme(option.value),
    }));

    return [
      { id: "new", label: "New note", hint: "⌘N", run: () => void createNote() },
      {
        id: "focus",
        label: focusMode ? "Exit focus mode" : "Focus mode",
        hint: "⌘.",
        run: toggleFocusMode,
      },
      { id: "appearance", label: "Appearance…", run: () => setSettingsOpen(true) },
      { id: "export-all", label: "Export all notes (.zip)", run: exportAll },
      { id: "shortcuts", label: "Keyboard shortcuts", hint: "⌘/", run: () => setShortcutsOpen(true) },
      { id: "outline", label: "Toggle outline", hint: "⌘⇧O", run: toggleOutline },
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
  }, [confirmEmptyTrash, copyHtml, copyMarkdown, counts.trash, createNote, duplicateNote, exportAll, exportCurrent, focusMode, installMode, note, openHistory, setSettingsOpen, setShortcutsOpen, setTheme, toggleFocusMode, toggleOutline, togglePin, trash]);

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
          event.preventDefault();
          focusPane("list");
          return;
        case "2":
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
        className={`${mobilePane === "list" ? "flex" : "hidden"} w-full flex-none flex-col ${
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
          onCreate={() => void createNote()}
          onEmptyTrash={confirmEmptyTrash}
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
        className={`${
          mobilePane === "editor" ? "flex" : "hidden"
        } min-w-0 flex-1 @[900px]:flex @[900px]:min-w-[420px]`}
      >
        <div className="min-w-0 flex-1">
          <EditorPane
            note={note}
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
            loading={noteLoading}
            onHistory={openHistory}
            onCreate={() => void createNote()}
            onDuplicate={() => void duplicateNote()}
            onCopy={() => void copyMarkdown()}
            onCopyHtml={() => void copyHtml()}
            onShare={canShare ? () => void shareNote() : undefined}
            onDownload={exportCurrent}
            onTag={searchTag}
            loadError={noteError}
            onRetry={() => setNoteReload((n) => n + 1)}
            highlight={debouncedQuery}
          />
        </div>
      </div>

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

      <Toaster position="bottom-center" />
    </div>
    </ClockProvider>
  );
}

function toListItem(note: NoteDetail): NoteListItem {
  const { body: _body, createdAt: _createdAt, ...row } = note;
  return row;
}
