"use client";

import { useState } from "react";
import type { EditorView } from "@codemirror/view";
import {
  BookOpenIcon,
  ChevronLeftIcon,
  PencilIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  LayoutTemplateIcon,
  CodeXmlIcon,
  FileDownIcon,
  CopyIcon,
  CopyPlusIcon,
  DownloadIcon,
  EllipsisIcon,
  HistoryIcon,
  Loader2Icon,
  ListTreeIcon,
  type LucideIcon,
  PanelLeftIcon,
  PinIcon,
  PlusIcon,
  RotateCcwIcon,
  ShareIcon,
  Trash2Icon,
} from "lucide-react";
import { Illustration } from "@/components/brand/Illustration";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Editor, type EditorStats, measure } from "@/components/editor/Editor";
import { FormatBar } from "@/components/editor/FormatBar";
import type { SaveStatus } from "@/components/editor/useAutosave";
import { relativeTime } from "@/lib/time";
import { COLOR_HEX, COLOR_LABEL, NOTE_COLORS, type NoteColor } from "@/lib/notes/colors";
import { EDITOR_FONTS, EDITOR_PADDINGS, EDITOR_WIDTHS, useUiStore } from "@/lib/store/useUiStore";
import type { NoteDetail } from "@/lib/types";
import { Backlinks } from "./Backlinks";
import { Outline } from "./Outline";
import { AppearanceButton } from "./AppearanceButton";
import { useClock } from "./ClockProvider";

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
  /** Gated actions in flight, by key, and whether the note is still loading (PRD §4.25). */
  pending: ReadonlySet<string>;
  loading: boolean;
  onHistory: () => void;
  onCreate?: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onCopyHtml: () => void;
  onPdf: () => void;
  /** Archive, colour label and template flags (PRD §4.65). */
  onLabels: (patch: LabelPatch) => void;
  /** Start a new note from this template. */
  onUseTemplate: () => void;
  /** Absent where the browser has no share sheet. */
  onShare?: () => void;
  onDownload: () => void;
  onTag: (tag: string) => void;
  highlight?: string;
  loadError?: string | null;
  onRetry?: () => void;
}

export interface LabelPatch {
  archived?: boolean;
  color?: NoteColor | null;
  template?: boolean;
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
  pending,
  loading,
  onHistory,
  onCreate,
  onDuplicate,
  onCopy,
  onCopyHtml,
  onPdf,
  onLabels,
  onUseTemplate,
  onShare,
  onDownload,
  onTag,
  highlight,
  loadError,
  onRetry,
}: EditorPaneProps) {
  const [stats, setStats] = useState<EditorStats>(() => measure(note?.body ?? ""));
  const [view, setView] = useState<EditorView | null>(null);
  const clock = useClock();

  const focusMode = useUiStore((s) => s.focusMode);
  const outlineOpen = useUiStore((s) => s.outlineOpen);
  const toggleOutline = useUiStore((s) => s.toggleOutline);
  const readingMode = useUiStore((s) => s.readingMode);
  const toggleReadingMode = useUiStore((s) => s.toggleReadingMode);
  const toggleFocusMode = useUiStore((s) => s.toggleFocusMode);
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const editorWidth = useUiStore((s) => s.editorWidth);
  const editorPadding = useUiStore((s) => s.editorPadding);
  const fontSize = useUiStore((s) => s.fontSize);
  const editorFont = useUiStore((s) => s.editorFont);
  const focusDim = useUiStore((s) => s.focusDim);

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
              Edited {relativeTime(note.updatedAt, clock.now, clock)}
              <span className="hidden @[480px]:inline">
                <span className="mx-1.5 opacity-40">·</span>
                {stats.words.toLocaleString()} {stats.words === 1 ? "word" : "words"}
              </span>
              {inTrash && <span className="ml-2 text-brand">In trash — read only</span>}
            </>
          )}
          {saveStatus === "failed" && (
            <span className="ml-2 text-brand">Couldn’t save — retrying.</span>
          )}
          {saveStatus === "offline" && (
            <span className="ml-2 text-brand" data-ursa-offline="">
              Offline — kept on this device, will sync.
            </span>
          )}
        </span>

        {note && (
          <div className="hidden @[900px]:contents">
            {inTrash ? (
              <IconAction
                icon={RotateCcwIcon}
                label="Restore note"
                onClick={onRestore}
                pending={pending.has(`restore:${note.id}`)}
              />
            ) : (
              <>
                <IconAction
                  icon={PinIcon}
                  label={note.pinned ? "Unpin note (⌘P)" : "Pin note (⌘P)"}
                  active={note.pinned}
                  onClick={onTogglePin}
                  pending={pending.has(`pin:${note.id}`)}
                />
                <IconAction icon={HistoryIcon} label="History" onClick={onHistory} />
                <IconAction
                  icon={Trash2Icon}
                  label="Move to trash (⌘⌫)"
                  onClick={onTrash}
                  pending={pending.has(`trash:${note.id}`)}
                />
              </>
            )}
            <NoteMenu
              inTrash={inTrash}
              trashing={false}
              duplicating={pending.has(`duplicate:${note.id}`)}
              outlineOpen={outlineOpen}
              onHistory={onHistory}
              onOutline={toggleOutline}
              onTrash={onTrash}
              onDuplicate={onDuplicate}
              onCopy={onCopy}
              onCopyHtml={onCopyHtml}
              onPdf={onPdf}
              labels={{ archived: Boolean(note.archivedAt), color: note.color ?? null, isTemplate: Boolean(note.isTemplate) }}
              onLabels={onLabels}
              onShare={onShare}
              onDownload={onDownload}
              readingMode={readingMode}
              onToggleReading={toggleReadingMode}
            />
            <Separator orientation="vertical" className="mx-1 !h-4" />
          </div>
        )}
        {/* Phones get the most-used action and a menu: seven 40px targets did
            not fit beside the status line (PRD R26.7). */}
        {note && (
          <div className="contents @[900px]:hidden">
            {inTrash ? (
              <IconAction
                icon={RotateCcwIcon}
                label="Restore note"
                onClick={onRestore}
                pending={pending.has(`restore:${note.id}`)}
              />
            ) : (
              <IconAction
                icon={PinIcon}
                label={note.pinned ? "Unpin note" : "Pin note"}
                active={note.pinned}
                onClick={onTogglePin}
                pending={pending.has(`pin:${note.id}`)}
              />
            )}
            <NoteMenu
              compact
              inTrash={inTrash}
              trashing={pending.has(`trash:${note.id}`)}
              duplicating={pending.has(`duplicate:${note.id}`)}
              outlineOpen={outlineOpen}
              onHistory={onHistory}
              onOutline={toggleOutline}
              onTrash={onTrash}
              onDuplicate={onDuplicate}
              onCopy={onCopy}
              onCopyHtml={onCopyHtml}
              onPdf={onPdf}
              labels={{ archived: Boolean(note.archivedAt), color: note.color ?? null, isTemplate: Boolean(note.isTemplate) }}
              onLabels={onLabels}
              onShare={onShare}
              onDownload={onDownload}
              readingMode={readingMode}
              onToggleReading={toggleReadingMode}
            />
          </div>
        )}

        <div className="hidden @[900px]:contents">
          <IconAction
            icon={ListTreeIcon}
            label={outlineOpen ? "Hide outline (⌘⇧O)" : "Show outline (⌘⇧O)"}
            active={outlineOpen}
            onClick={toggleOutline}
          />
        </div>

        <div className="hidden @[900px]:contents">
          <IconAction
            icon={PanelLeftIcon}
            label={focusMode ? "Exit focus mode (⌘.)" : "Focus mode (⌘.)"}
            active={focusMode}
            onClick={toggleFocusMode}
          />
          <AppearanceButton open={settingsOpen} onOpenChange={setSettingsOpen} />
        </div>
      </header>

      {/* A template or an archived note says so, with the one action that
          matters for it (PRD §4.65). */}
      {note && !inTrash && (note.isTemplate || note.archivedAt) && (
        <div className="ursa-fade-in flex flex-none items-center justify-center gap-3 border-b border-border bg-brand-soft px-4 py-1.5 text-[0.78rem] text-brand">
          {note.isTemplate ? (
            <>
              <span className="flex items-center gap-1.5">
                <LayoutTemplateIcon className="size-3.5" />
                Template — edits here change it for next time
              </span>
              <button type="button" onClick={onUseTemplate} className="rounded-md bg-brand px-2 py-0.5 font-semibold text-on-brand hover:bg-brand/90">
                New note from this
              </button>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                <ArchiveIcon className="size-3.5" />
                Archived
              </span>
              <button type="button" onClick={() => onLabels({ archived: false })} className="font-semibold underline-offset-2 hover:underline">
                Move back to Notes
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
      <div
        className={`ursa-editor-host min-h-0 min-w-0 flex-1 transition-opacity duration-150 ${loading ? "opacity-55" : ""}`}
        data-ursa-dim={focusDim ? "" : undefined}
        aria-busy={loading}
        style={
          {
            "--editor-measure": measureRem === 0 ? "none" : `${measureRem}rem`,
            "--editor-pad": `${padRem}rem`,
            "--editor-size": `${fontSize}px`,
            "--editor-family": (EDITOR_FONTS.find((f) => f.value === editorFont) ?? EDITOR_FONTS[0]!).css,
          } as React.CSSProperties
        }
      >
        {note ? (
          <Editor
            noteId={note.id}
            initialBody={note.body}
            readOnly={inTrash || readingMode}
            onChange={onChange}
            onBlur={onBlur}
            onStats={setStats}
            onWikiLink={onWikiLink}
            onTag={onTag}
            highlight={highlight}
            onReady={setView}
          />
        ) : loadError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 pb-16 text-center" role="alert">
            <p className="text-[0.95rem] font-semibold tracking-tight text-ink">Couldn’t open this note</p>
            <p className="max-w-80 text-[0.78rem] text-ink-faint">{loadError}</p>
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RotateCcwIcon />
                Try again
              </Button>
            )}
          </div>
        ) : (
          <div className="ursa-fade-in flex h-full flex-col items-center justify-center gap-4 px-8 pb-16 text-center">
            <Illustration kind="write" size={132} />
            <div className="flex flex-col gap-1">
              <p className="text-[0.95rem] font-semibold tracking-tight text-ink">Pick a note, or start one</p>
              <p className="text-[0.78rem] text-ink-faint">Everything saves as you type.</p>
            </div>
            {onCreate && (
              <Button size="sm" onClick={onCreate} disabled={pending.has("create")}>
                {pending.has("create") ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
                New note
              </Button>
            )}
            <dl className="mt-2 flex flex-col gap-1.5 text-[0.75rem] text-ink-faint">
              <Shortcut keys="⌘N" label="New note" />
              <Shortcut keys="⌘K" label="Command palette" />
              <Shortcut keys="⌘F" label="Search" />
            </dl>
          </div>
        )}
      </div>
      <Outline view={view} open={outlineOpen && note !== null} />
      </div>

      {/* Inside the host so --editor-measure resolves and the strip lines up
          with the text column rather than the pane. */}
      <div
        className="ursa-editor-host flex-none"
        style={{ "--editor-measure": measureRem === 0 ? "none" : `${measureRem}rem` } as React.CSSProperties}
      >
        <Backlinks noteId={note?.id ?? null} onOpen={onOpenNote} />
      </div>

      {note && !inTrash && !readingMode && <FormatBar view={view} />}
      {note && !inTrash && readingMode && (
        <button
          type="button"
          onClick={toggleReadingMode}
          data-ursa-reading=""
          className="ursa-fab-in absolute bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-raised/95 px-4 py-2 text-[0.8rem] font-medium text-ink-soft shadow-[var(--shadow)] backdrop-blur active:scale-95"
        >
          <BookOpenIcon className="size-4 text-brand" />
          Reading · tap to edit
        </button>
      )}
    </section>
  );
}

/**
 * The note's ⋯ menu. On a phone it also carries History, Outline and Trash,
 * which have their own buttons on a desktop (PRD R26.7, §4.40).
 */
function NoteMenu({
  compact = false,
  inTrash,
  trashing,
  duplicating,
  outlineOpen,
  onHistory,
  onOutline,
  onTrash,
  onDuplicate,
  onCopy,
  onCopyHtml,
  onPdf,
  labels,
  onLabels,
  onShare,
  onDownload,
  readingMode,
  onToggleReading,
}: {
  compact?: boolean;
  inTrash: boolean;
  trashing: boolean;
  duplicating: boolean;
  outlineOpen: boolean;
  onHistory: () => void;
  onOutline: () => void;
  onTrash: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onCopyHtml: () => void;
  onPdf: () => void;
  labels: { archived: boolean; color: NoteColor | null; isTemplate: boolean };
  onLabels: (patch: LabelPatch) => void;
  onShare?: () => void;
  onDownload: () => void;
  readingMode: boolean;
  onToggleReading: () => void;
}) {
  const busy = trashing || duplicating;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label="More actions" className="text-ink-faint">
            {busy ? <Loader2Icon className="animate-spin" /> : <EllipsisIcon />}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-52">
        {compact && (
          <>
            <DropdownMenuItem onClick={onHistory}>
              <HistoryIcon />
              History
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOutline}>
              <ListTreeIcon />
              {outlineOpen ? "Hide outline" : "Show outline"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {!inTrash && (
          <>
            <DropdownMenuItem onClick={onToggleReading}>
              {readingMode ? <PencilIcon /> : <BookOpenIcon />}
              {readingMode ? "Edit" : "Reading mode"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {onShare && (
          <DropdownMenuItem onClick={onShare}>
            <ShareIcon />
            Share…
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onCopy}>
          <CopyIcon />
          Copy as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCopyHtml}>
          <CodeXmlIcon />
          Copy as HTML
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPdf}>
          <FileDownIcon />
          Export as PDF
        </DropdownMenuItem>
        {!inTrash && (
          <DropdownMenuItem disabled={duplicating} onClick={onDuplicate}>
            <CopyPlusIcon />
            Duplicate
          </DropdownMenuItem>
        )}
        {!inTrash && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onLabels({ archived: !labels.archived })}>
              {labels.archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
              {labels.archived ? "Move back to Notes" : "Archive"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onLabels({ template: !labels.isTemplate })}>
              <LayoutTemplateIcon />
              {labels.isTemplate ? "Stop using as a template" : "Save as template"}
            </DropdownMenuItem>
            {/* Colour labels (PRD §4.65): one row of dots, the current one ringed. */}
            <div className="flex items-center gap-1 px-2 py-1.5" role="group" aria-label="Colour label">
              {NOTE_COLORS.map((color) => (
                <DropdownMenuItem
                  key={color}
                  aria-label={`${COLOR_LABEL[color]} label${labels.color === color ? " (current)" : ""}`}
                  onClick={() => onLabels({ color: labels.color === color ? null : color })}
                  className="size-7 justify-center rounded-full p-0"
                >
                  <span
                    aria-hidden
                    className={`size-4 rounded-full ${labels.color === color ? "ring-2 ring-ink ring-offset-2 ring-offset-popover" : ""}`}
                    style={{ background: COLOR_HEX[color] }}
                  />
                </DropdownMenuItem>
              ))}
            </div>
          </>
        )}
        <DropdownMenuItem onClick={onDownload}>
          <DownloadIcon />
          Download .md
        </DropdownMenuItem>
        {compact && !inTrash && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={trashing} onClick={onTrash}>
              <Trash2Icon />
              Move to trash
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function IconAction({
  icon: Icon,
  label,
  onClick,
  active = false,
  pending = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  pending?: boolean;
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
            aria-busy={pending}
            disabled={pending}
            onClick={onClick}
            className={active ? "bg-brand-soft text-brand" : "text-ink-faint"}
          >
            {pending ? <Loader2Icon className="animate-spin" /> : <Icon />}
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
