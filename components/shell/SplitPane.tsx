"use client";

import { useEffect, useState } from "react";
import { FileTextIcon, LockIcon, PanelRightOpenIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Editor } from "@/components/editor/Editor";
import { displayTitle } from "@/lib/markdown/derive";
import { EDITOR_FONTS, EDITOR_PADDINGS, EDITOR_WIDTHS, useUiStore } from "@/lib/store/useUiStore";
import type { NoteDetail } from "@/lib/types";
import { TabStrip } from "./TabStrip";

/**
 * The second note pane (PRD §4.80). It edits like the main pane — the same
 * autosave, versions and device outbox, through the shell's `load` and
 * `onChange` — with a lighter frame: tabs, the note, and nothing else. Note
 * actions (history, share, lock, trash) live on the main pane; a locked note
 * opens there, where it can be unlocked and re-locks when you leave it.
 */
export function SplitPane({
  load,
  onChange,
  onBlur,
  onWikiLink,
  onTag,
  titleOf,
  lockedOf,
  suggestions,
  onNew,
  reloadSignal,
}: {
  /** Fetch a note, preferring text this device has not saved yet. */
  load: (id: string, signal: AbortSignal) => Promise<NoteDetail>;
  onChange: (id: string, body: string) => void;
  onBlur: () => void;
  onWikiLink: (title: string) => void;
  onTag: (tag: string) => void;
  titleOf: (id: string) => string;
  lockedOf: (id: string) => boolean;
  /** Notes to offer while the pane is empty: open tabs and recent notes. */
  suggestions: Array<{ id: string; title: string }>;
  onNew: () => void;
  /** Bumped when the shell wants the shown note fetched again (a conflict, coming back). */
  reloadSignal: number;
}) {
  const split = useUiStore((s) => s.split);
  const focused = useUiStore((s) => s.focusedPane === "split");
  const openNote = useUiStore((s) => s.openNote);
  const closeTab = useUiStore((s) => s.closeTab);
  const reorderTab = useUiStore((s) => s.reorderTab);
  const closeSplit = useUiStore((s) => s.closeSplit);

  const editorWidth = useUiStore((s) => s.editorWidth);
  const editorPadding = useUiStore((s) => s.editorPadding);
  const fontSize = useUiStore((s) => s.fontSize);
  const editorFont = useUiStore((s) => s.editorFont);
  const readingMode = useUiStore((s) => s.readingMode);
  const typewriterMode = useUiStore((s) => s.typewriterMode);

  const activeId = split?.tabs.active ?? null;
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setError(null);
    if (!activeId) {
      setNote(null);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    load(activeId, controller.signal)
      .then((loaded) => {
        if (!cancelled) setNote(loaded);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setNote(null);
        setError(reason instanceof Error ? reason.message : "Couldn’t open this note.");
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeId, retry, reloadSignal, load]);

  if (!split) return null;

  const measureRem = EDITOR_WIDTHS.find((o) => o.value === editorWidth)?.rem ?? 44;
  const padRem = EDITOR_PADDINGS.find((o) => o.value === editorPadding)?.rem ?? 3;
  const shown = note && note.id === activeId ? note : null;
  const locked = shown ? shown.locked || shown.sealed : false;
  /** Close it here and open it in a new tab of the main pane. */
  const moveToMain = (id: string) => {
    closeTab("split", id);
    openNote(id, { pane: "main", newTab: true });
  };

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col bg-canvas" aria-label="Second note">
      <TabStrip
        label="Notes in the second pane"
        ids={split.tabs.ids}
        active={activeId}
        focused={focused}
        titleOf={titleOf}
        lockedOf={lockedOf}
        onSelect={(id) => openNote(id, { pane: "split" })}
        onClose={(id) => closeTab("split", id)}
        onReorder={(id, to) => reorderTab("split", id, to)}
        onNew={onNew}
        trailing={
          <div className="flex flex-none items-center gap-0.5 border-l border-border px-1">
            {activeId && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Move to the main pane"
                title="Move to the main pane"
                onClick={() => moveToMain(activeId)}
                className="text-ink-faint"
              >
                <PanelRightOpenIcon className="rotate-180" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close split"
              title="Close split (⌘\)"
              onClick={closeSplit}
              className="text-ink-faint"
            >
              <XIcon />
            </Button>
          </div>
        }
      />
      <div
        className="ursa-editor-host min-h-0 min-w-0 flex-1"
        style={
          {
            "--editor-measure": measureRem === 0 ? "none" : `${measureRem}rem`,
            "--editor-pad": `${Math.min(padRem, 2)}rem`,
            "--editor-size": `${fontSize}px`,
            "--editor-family": (EDITOR_FONTS.find((f) => f.value === editorFont) ?? EDITOR_FONTS[0]!).css,
          } as React.CSSProperties
        }
      >
        {shown && locked ? (
          <Message
            icon={<LockIcon className="size-5" />}
            title="This note is locked"
            detail="Locked notes open in the main pane, where they can be unlocked."
            action={<Button size="sm" variant="outline" onClick={() => moveToMain(shown.id)}>Open in the main pane</Button>}
          />
        ) : shown ? (
          <Editor
            noteId={shown.id}
            initialBody={shown.body}
            readOnly={shown.deletedAt != null || readingMode}
            onChange={onChange}
            onBlur={onBlur}
            onWikiLink={onWikiLink}
            onTag={onTag}
            typewriterMode={typewriterMode}
          />
        ) : error ? (
          <Message
            title="Couldn’t open this note"
            detail={error}
            action={
              <Button size="sm" variant="outline" onClick={() => setRetry((n) => n + 1)}>
                <RotateCcwIcon />
                Try again
              </Button>
            }
          />
        ) : activeId ? null : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 pb-12 text-center">
            <div className="flex flex-col gap-1">
              <p className="text-[0.95rem] font-semibold tracking-tight text-ink">Open a note here</p>
              <p className="text-[0.78rem] text-ink-faint">Pick one from the list, or one of these.</p>
            </div>
            {suggestions.length > 0 && (
              <ul className="flex w-full max-w-72 flex-col gap-0.5 text-left">
                {suggestions.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        // A tab in the main pane moves here rather than opening twice.
                        const state = useUiStore.getState();
                        if (state.mainTabs.includes(item.id)) state.closeTab("main", item.id);
                        openNote(item.id, { pane: "split" });
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[0.82rem] text-ink-soft hover:bg-ink/5 hover:text-ink"
                    >
                      <FileTextIcon className="size-3.5 flex-none text-ink-faint" />
                      <span data-ursa-private="" className="ursa-private-text truncate">
                        {displayTitle(item.title)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Button size="sm" variant="outline" onClick={onNew}>
              New note
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function Message({
  icon,
  title,
  detail,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 pb-16 text-center" role="status">
      {icon && <div className="text-ink-faint">{icon}</div>}
      <p className="text-[0.95rem] font-semibold tracking-tight text-ink">{title}</p>
      <p className="max-w-72 text-[0.78rem] text-ink-faint">{detail}</p>
      {action}
    </div>
  );
}
