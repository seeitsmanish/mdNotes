"use client";

import { useState } from "react";
import type { EditorView } from "@codemirror/view";
import {
  ChevronLeftIcon,
  ListTreeIcon,
  type LucideIcon,
  PaletteIcon,
  PanelLeftIcon,
  PinIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Editor, type EditorStats, measure } from "@/components/editor/Editor";
import { FormatBar } from "@/components/editor/FormatBar";
import type { SaveStatus } from "@/components/editor/useAutosave";
import { relativeTime } from "@/lib/time";
import { EDITOR_PADDINGS, EDITOR_WIDTHS, useUiStore } from "@/lib/store/useUiStore";
import type { NoteDetail } from "@/lib/types";
import { Backlinks } from "./Backlinks";
import { Outline } from "./Outline";
import { SettingsPanel } from "./SettingsPanel";
import { useUnseenRelease } from "./WhatsNew";

/**
 * The right pane: a status strip above the editor, and the floating format bar
 * below it.
 *
 * The top strip carries document actions only. Formatting lives in the floating
 * bar, and every control there writes the same markup the keyboard would — the
 * text remains the source of truth.
 */

interface EditorPaneProps {
  note: NoteDetail | null;
  saveStatus: SaveStatus;
  onChange: (noteId: string, body: string) => void;
  onBlur: () => void;
  onTogglePin: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onBack: () => void;
  onWikiLink: (title: string) => void;
  onOpenNote: (id: string) => void;
}

export function EditorPane({
  note,
  saveStatus,
  onChange,
  onBlur,
  onTogglePin,
  onTrash,
  onRestore,
  onBack,
  onWikiLink,
  onOpenNote,
}: EditorPaneProps) {
  const [stats, setStats] = useState<EditorStats>(() => measure(note?.body ?? ""));
  const [view, setView] = useState<EditorView | null>(null);
  const { unseen } = useUnseenRelease();

  const focusMode = useUiStore((s) => s.focusMode);
  const outlineOpen = useUiStore((s) => s.outlineOpen);
  const toggleOutline = useUiStore((s) => s.toggleOutline);
  const toggleFocusMode = useUiStore((s) => s.toggleFocusMode);
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const editorWidth = useUiStore((s) => s.editorWidth);
  const editorPadding = useUiStore((s) => s.editorPadding);
  const fontSize = useUiStore((s) => s.fontSize);
  const editorFont = useUiStore((s) => s.editorFont);

  const inTrash = note?.deletedAt != null;
  const measureRem = EDITOR_WIDTHS.find((o) => o.value === editorWidth)?.rem ?? 44;
  const padRem = EDITOR_PADDINGS.find((o) => o.value === editorPadding)?.rem ?? 3;

  return (
    <section className="relative flex h-full min-w-0 flex-col bg-canvas">
      <header className="flex h-11 flex-none items-center gap-0.5 border-b border-border px-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
          aria-label="Back to note list"
          className="@[900px]:hidden"
        >
          <ChevronLeftIcon />
        </Button>

        <span className="ml-1.5 min-w-0 flex-1 truncate text-[0.72rem] text-ink-faint">
          {note && (
            <>
              Edited {relativeTime(note.updatedAt)}
              <span className="mx-1.5 opacity-40">·</span>
              {stats.words.toLocaleString()} {stats.words === 1 ? "word" : "words"}
              {inTrash && <span className="ml-2 text-brand">In trash — read only</span>}
            </>
          )}
          {saveStatus === "failed" && (
            <span className="ml-2 text-brand">Couldn’t save — retrying on next edit.</span>
          )}
        </span>

        {note && (
          <>
            {inTrash ? (
              <IconAction icon={RotateCcwIcon} label="Restore note" onClick={onRestore} />
            ) : (
              <>
                <IconAction
                  icon={PinIcon}
                  label={note.pinned ? "Unpin note (⌘P)" : "Pin note (⌘P)"}
                  active={note.pinned}
                  onClick={onTogglePin}
                />
                <IconAction icon={Trash2Icon} label="Move to trash (⌘⌫)" onClick={onTrash} />
              </>
            )}
            <Separator orientation="vertical" className="mx-1 !h-4" />
          </>
        )}

        <IconAction
          icon={ListTreeIcon}
          label={outlineOpen ? "Hide outline (⌘⇧O)" : "Show outline (⌘⇧O)"}
          active={outlineOpen}
          onClick={toggleOutline}
        />

        <IconAction
          icon={PanelLeftIcon}
          label={focusMode ? "Exit focus mode (⌘.)" : "Focus mode (⌘.)"}
          active={focusMode}
          onClick={toggleFocusMode}
        />

        <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={unseen ? "Appearance — new release notes" : "Appearance"}
                className={`relative ${settingsOpen ? "bg-brand-soft text-brand" : "text-ink-faint"}`}
              >
                <PaletteIcon />
                {unseen && (
                  <span
                    aria-hidden
                    className="absolute right-1 top-1 size-1.5 rounded-full bg-brand ring-2 ring-canvas"
                  />
                )}
              </Button>
            }
          />
          <PopoverContent align="end" className="w-76">
            <SettingsPanel />
          </PopoverContent>
        </Popover>
      </header>

      <div className="flex min-h-0 flex-1">
      <div
        className="ursa-editor-host min-h-0 flex-1"
        style={
          {
            "--editor-measure": measureRem === 0 ? "none" : `${measureRem}rem`,
            "--editor-pad": `${padRem}rem`,
            "--editor-size": `${fontSize}px`,
            "--editor-family":
              editorFont === "serif"
                ? "var(--font-serif)"
                : editorFont === "mono"
                  ? "var(--font-mono)"
                  : "var(--font-sans)",
          } as React.CSSProperties
        }
      >
        {note ? (
          <Editor
            noteId={note.id}
            initialBody={note.body}
            readOnly={inTrash}
            onChange={onChange}
            onBlur={onBlur}
            onStats={setStats}
            onWikiLink={onWikiLink}
            onReady={setView}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="text-[0.85rem] font-medium text-ink-soft">No note selected</p>
            <dl className="flex flex-col gap-1.5 text-[0.75rem] text-ink-faint">
              <Shortcut keys="⌘N" label="New note" />
              <Shortcut keys="⌘K" label="Command palette" />
              <Shortcut keys="⌘F" label="Search" />
            </dl>
          </div>
        )}
      </div>
      <Outline view={view} open={outlineOpen && note !== null} />
      </div>

      <Backlinks noteId={note?.id ?? null} onOpen={onOpenNote} />

      {note && !inTrash && <FormatBar view={view} />}
    </section>
  );
}

function IconAction({
  icon: Icon,
  label,
  onClick,
  active = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            aria-pressed={active}
            onClick={onClick}
            className={active ? "bg-brand-soft text-brand" : "text-ink-faint"}
          >
            <Icon />
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function Shortcut({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <dt className="w-28 text-right">{label}</dt>
      <dd>
        <kbd className="rounded-md border border-border bg-raised px-1.5 py-0.5 font-sans text-[0.7rem] text-ink-soft shadow-sm">
          {keys}
        </kbd>
      </dd>
    </div>
  );
}
