"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  CopyIcon,
  CopyPlusIcon,
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  ShareIcon,
  Loader2Icon,
  ChevronDownIcon,
  type LucideIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  CalendarDaysIcon,
  PinIcon,
  PinOffIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  SquarePenIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useUiStore } from "@/lib/store/useUiStore";
import { Illustration } from "@/components/brand/Illustration";
import { AppearanceButton } from "./AppearanceButton";
import { SwipeAction, SwipeRow } from "./SwipeRow";
import { useClock } from "./ClockProvider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { displayExcerpt, displayTitle } from "@/lib/markdown/derive";
import { sectionNotes } from "@/lib/notes/sections";
import { relativeTime } from "@/lib/time";
import { COLOR_HEX, COLOR_LABEL, NOTE_COLORS } from "@/lib/notes/colors";
import type { NoteCounts, NoteFilter, NoteListItem, SearchMatch } from "@/lib/types";

/**
 * The left pane: a header carrying the current filter, an optional search
 * field, and the rows.
 *
 * A row gives the title two lines and the preview two more, because a title is
 * the only thing most notes are found by and truncating it to one line throws
 * away the half that identifies it.
 */

const FILTERS: Array<{ value: NoteFilter; label: string }> = [
  { value: "all", label: "Notes" },
  { value: "pinned", label: "Pinned" },
  { value: "archive", label: "Archive" },
  { value: "templates", label: "Templates" },
  { value: "trash", label: "Trash" },
];

interface NoteListProps {
  notes: NoteListItem[];
  counts: NoteCounts;
  filter: NoteFilter;
  query: string;
  selectedNoteId: string | null;
  loading: boolean;
  onFilterChange: (filter: NoteFilter) => void;
  onQueryChange: (query: string) => void;
  onSelect: (id: string) => void;
  onTogglePin: (note: NoteListItem) => void;
  onTrash: (note: NoteListItem) => void;
  onRestore: (note: NoteListItem) => void;
  onDeleteForever: (note: NoteListItem) => void;
  /** The swipe menu's actions on any row (PRD §4.52). */
  onRowAction: (note: NoteListItem, kind: "copy" | "share" | "duplicate") => void;
  canShare: boolean;
  /** Gated actions in flight, by key (PRD §4.25). */
  pending: ReadonlySet<string>;
  /** Changes when something outside asks for the search field (PRD §4.31). */
  searchSignal?: number;
  onCreate: () => void;
  onEmptyTrash: () => void;
  /** Today's daily note (PRD §4.65). */
  onToday: () => void;
  onArchive: (note: NoteListItem) => void;
}

export function NoteList({
  notes,
  counts,
  filter,
  query,
  selectedNoteId,
  loading,
  onFilterChange,
  onQueryChange,
  onSelect,
  onTogglePin,
  onTrash,
  onRestore,
  onDeleteForever,
  onRowAction,
  canShare,
  pending,
  searchSignal = 0,
  onCreate,
  onEmptyTrash,
  onToday,
  onArchive,
}: NoteListProps) {
  const colorFilter = useUiStore((state) => state.colorFilter);
  const setColorFilter = useUiStore((state) => state.setColorFilter);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const privacyMode = useUiStore((state) => state.privacyMode);
  const togglePrivacyMode = useUiStore((state) => state.togglePrivacyMode);
  // One swiped-open row at a time, as on iOS (PRD §4.52).
  const [swipedId, setSwipedId] = useState<string | null>(null);

  // Focus once the field exists: requesting it in the same tick as opening
  // the field ran before the field had rendered (PRD §4.31).
  const focusWhenOpen = useRef(false);
  useEffect(() => {
    if (searchSignal === 0) return;
    focusWhenOpen.current = true;
    setSearchOpen(true);
  }, [searchSignal]);
  useEffect(() => {
    if (!searchOpen || !focusWhenOpen.current) return;
    focusWhenOpen.current = false;
    searchRef.current?.focus();
  }, [searchOpen]);

  const clock = useClock();
  const inTrash = filter === "trash";
  const current = FILTERS.find((entry) => entry.value === filter) ?? FILTERS[0]!;

  // Section headers (PRD R38.1) — not over search results, whose order is
  // about the match rather than the date.
  const searching = query.trim().length > 0;
  const sectionStarts = new Map<string, string>();
  if (!searching) {
    for (const section of sectionNotes(notes, clock.now, clock)) sectionStarts.set(section.items[0]!.id, section.label);
  }

  // Search stays reachable from the keyboard even while it is collapsed.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "f") {
        event.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => {
          searchRef.current?.focus();
          searchRef.current?.select();
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="relative flex h-full flex-col bg-list">
      <header className="flex-none px-3 pb-1 pt-3">
        <div className="flex items-center justify-between gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="sm" className="-ml-1.5 gap-1 text-[0.95rem] font-semibold tracking-tight">
                  {colorFilter && (
                    <span
                      aria-label={`${COLOR_LABEL[colorFilter]} only`}
                      className="size-2.5 rounded-full"
                      style={{ background: COLOR_HEX[colorFilter] }}
                    />
                  )}
                  {current.label}
                  <ChevronDownIcon className="opacity-55" />
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="min-w-44">
              <DropdownMenuRadioGroup
                value={filter}
                onValueChange={(value) => onFilterChange(value as NoteFilter)}
              >
                {FILTERS.map((entry) => (
                  <DropdownMenuRadioItem key={entry.value} value={entry.value} closeOnClick>
                    <span className="flex-1">{entry.label}</span>
                    <span className="text-xs text-muted-foreground">{counts[entry.value] ?? 0}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              {/* Colour filter (PRD §4.65): narrows whichever list is shown. */}
              <div className="px-2 pb-1 pt-1.5 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
                Colour
              </div>
              <div className="flex flex-wrap items-center gap-1 px-1.5 pb-1.5">
                {NOTE_COLORS.map((color) => (
                  <DropdownMenuItem
                    key={color}
                    aria-label={`Only ${COLOR_LABEL[color].toLowerCase()} notes${colorFilter === color ? " (on)" : ""}`}
                    onClick={() => setColorFilter(colorFilter === color ? null : color)}
                    className="size-7 justify-center rounded-full p-0"
                  >
                    <span
                      aria-hidden
                      className={`size-4 rounded-full ${colorFilter === color ? "ring-2 ring-ink ring-offset-2 ring-offset-popover" : ""}`}
                      style={{ background: COLOR_HEX[color] }}
                    />
                  </DropdownMenuItem>
                ))}
                {colorFilter && (
                  <DropdownMenuItem onClick={() => setColorFilter(null)} className="h-7 px-2 text-xs">
                    Any
                  </DropdownMenuItem>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-0.5">
            {/* On a phone the floating button below does this; in the trash,
                where that button is hidden, this stays. */}
            <div className={inTrash ? "contents" : "hidden @[900px]:contents"}>
              <IconAction
                icon={SquarePenIcon}
                label={pending.has("create") ? "Creating a note…" : "New note (⌘N)"}
                onClick={onCreate}
                pending={pending.has("create")}
              />
            </div>
            <IconAction
              icon={CalendarDaysIcon}
              label={pending.has("today") ? "Opening today’s note…" : "Today’s note"}
              onClick={onToday}
              pending={pending.has("today")}
            />
            <IconAction
              icon={SearchIcon}
              label="Search (⌘F)"
              active={searchOpen}
              onClick={() => {
                const next = !searchOpen;
                setSearchOpen(next);
                if (next) requestAnimationFrame(() => searchRef.current?.focus());
                else onQueryChange("");
              }}
            />
            <IconAction
              icon={privacyMode ? EyeOffIcon : EyeIcon}
              label={privacyMode ? "Show note titles (⌘⇧L)" : "Hide note titles for screen sharing (⌘⇧L)"}
              active={privacyMode}
              onClick={togglePrivacyMode}
            />
            {/* On a phone the editor's toolbar is out of sight until a note is
                open, so Appearance (and What's new, sign out…) lives here too. */}
            <div className="contents @[900px]:hidden">
              <AppearanceButton open={appearanceOpen} onOpenChange={setAppearanceOpen} />
            </div>
          </div>
        </div>

        {/* Out of the list's way, so every row stays clickable (PRD R59.2). */}
        {privacyMode && (
          <div className="ursa-fade-in mt-2 flex items-center justify-between gap-2 rounded-lg bg-brand-soft px-2.5 py-1.5 text-[0.74rem] text-brand">
            <span className="flex items-center gap-1.5">
              <EyeOffIcon className="size-3.5" />
              Titles hidden for screen sharing
            </span>
            <button type="button" onClick={togglePrivacyMode} className="font-semibold underline-offset-2 hover:underline">
              Show
            </button>
          </div>
        )}

        {/* Only offered when there is something to empty (PRD R12.3). */}
        {inTrash && counts.trash > 0 && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onEmptyTrash}
              className="w-full text-ink-soft hover:text-brand"
            >
              <Trash2Icon />
              Empty trash ({counts.trash})
            </Button>
          </div>
        )}

        {searchOpen && (
          <div className="ursa-fade-in pt-2">
            <Input
              ref={searchRef}
              type="search"
              value={query}
              placeholder="Search notes"
              aria-label="Search notes"
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                onQueryChange("");
                setSearchOpen(false);
              }}
              className="h-8 text-[0.8rem]"
            />
          </div>
        )}
      </header>

      {notes.length === 0 && !loading ? (
        <EmptyState inTrash={inTrash} filter={filter} colored={colorFilter !== null} searching={searching} onCreate={onCreate} />
      ) : (
        <ul
          className="flex-1 overflow-y-auto px-3 pb-24 pt-1 @[900px]:pb-4"
          onKeyDown={moveFocusOnArrows}
          data-ursa-private=""
        >
          {notes.map((note, index) => {
            const selected = note.id === selectedNoteId;
            const section = sectionStarts.get(note.id);
            const nextStartsSection = sectionStarts.has(notes[index + 1]?.id ?? "");
            return (
              <Fragment key={note.id}>
              {section && (
                <li
                  role="presentation"
                  className="sticky top-0 z-10 bg-list/95 px-4 pb-1.5 pt-3 text-[0.68rem] font-semibold uppercase tracking-wider text-ink-faint backdrop-blur first:pt-1"
                  data-ursa-section=""
                >
                  {section}
                </li>
              )}
              <li
                className="ursa-row-in group relative"
                style={{ animationDelay: `${Math.min(index, 12) * 18}ms` }}
                // Once only: a phone re-showing the list pane would replay it
                // for every row. React leaves the class alone afterwards, as
                // the className prop itself does not change.
                onAnimationEnd={(event) => {
                  if (event.target === event.currentTarget) event.currentTarget.classList.remove("ursa-row-in");
                }}
              >
                <SwipeRow
                  open={swipedId === note.id}
                  onOpenChange={(open) =>
                    setSwipedId((current) => (open ? note.id : current === note.id ? null : current))
                  }
                  actionsWidth={inTrash ? 168 : 156}
                  onFullSwipe={inTrash ? undefined : () => onTrash(note)}
                  actions={
                    inTrash ? (
                      <>
                        <SwipeAction
                          label="Restore"
                          tone="brand"
                          icon={<RotateCcwIcon />}
                          disabled={pending.has(`restore:${note.id}`)}
                          onClick={() => {
                            setSwipedId(null);
                            onRestore(note);
                          }}
                        />
                        <SwipeAction
                          label="Delete"
                          tone="danger"
                          icon={<XIcon />}
                          disabled={pending.has(`delete:${note.id}`)}
                          onClick={() => {
                            setSwipedId(null);
                            if (window.confirm(`Delete “${displayTitle(note.title)}” permanently? This cannot be undone.`)) {
                              onDeleteForever(note);
                            }
                          }}
                        />
                      </>
                    ) : (
                      <>
                        <SwipeMore
                          note={note}
                          canShare={canShare}
                          onPin={() => onTogglePin(note)}
                          onArchive={() => onArchive(note)}
                          onAction={(kind) => onRowAction(note, kind)}
                          onDone={() => setSwipedId(null)}
                        />
                        <SwipeAction
                          label="Delete"
                          tone="danger"
                          icon={<Trash2Icon />}
                          disabled={pending.has(`trash:${note.id}`)}
                          onClick={() => {
                            setSwipedId(null);
                            onTrash(note);
                          }}
                        />
                      </>
                    )
                  }
                >
                  <button
                    type="button"
                    data-ursa-row=""
                    aria-current={selected ? "true" : undefined}
                    onClick={() => onSelect(note.id)}
                    className={`relative block w-full rounded-lg py-2.5 pl-4 pr-3 text-left transition-[background-color,transform] duration-150 active:scale-[0.985] ${
                      selected ? "bg-row-active" : "hover:bg-row-hover"
                    }`}
                  >
                    {/* The bar is the selection signal; the fill alone is too quiet. */}
                    <span
                      aria-hidden
                      className={`absolute inset-y-2 left-1 w-[3px] rounded-full transition-colors ${
                        selected ? "bg-brand" : "bg-transparent"
                      }`}
                    />

                    <span className="flex items-start gap-3">
                    <span className="block min-w-0 flex-1">
                    <span className="flex items-start gap-1.5">
                      {note.color && (
                        <span
                          aria-label={`${COLOR_LABEL[note.color]} label`}
                          className="mt-[0.38rem] size-2 flex-none rounded-full"
                          style={{ background: COLOR_HEX[note.color] }}
                        />
                      )}
                      {note.pinned && (
                        <PinIcon
                          size={11}
                          strokeWidth={2}
                          fill="currentColor"
                          aria-label="Pinned"
                          className="mt-[0.3rem] flex-none text-brand"
                        />
                      )}
                      <span className="line-clamp-2 min-w-0 flex-1 text-[0.84rem] font-semibold leading-snug tracking-tight text-heading">
                        {displayTitle(note.title)}
                      </span>
                    </span>

                    <span className="mt-1 line-clamp-2 block text-[0.76rem] leading-snug text-ink-soft">
                      {note.match ? (
                        <Highlighted match={note.match} />
                      ) : (
                        displayExcerpt(note.excerpt) || "No additional text"
                      )}
                    </span>

                    <span className="mt-1.5 flex items-center gap-2 text-[0.7rem] tabular-nums text-ink-faint">
                      {relativeTime(note.updatedAt, clock.now, clock)}
                      {note.todoTotal > 0 && <TodoChip done={note.todoDone} total={note.todoTotal} />}
                    </span>
                    </span>
                    {note.cover && <RowCover src={note.cover} />}
                    </span>
                  </button>
                </SwipeRow>

                <span
                  className={`ursa-row-actions absolute bottom-2 flex ${note.cover ? "right-[4.5rem]" : "right-3"} items-center gap-0.5 transition-opacity focus-within:opacity-100 group-hover:opacity-100 ${
                    ["pin", "trash", "restore", "delete"].some((k) => pending.has(`${k}:${note.id}`))
                      ? "opacity-100"
                      : "opacity-0"
                  }`}
                >
                  {inTrash ? (
                    <>
                      <RowAction
                        icon={RotateCcwIcon}
                        label="Restore"
                        onClick={() => onRestore(note)}
                        pending={pending.has(`restore:${note.id}`)}
                      />
                      <RowAction
                        icon={XIcon}
                        label="Delete permanently"
                        danger
                        onClick={() => onDeleteForever(note)}
                        pending={pending.has(`delete:${note.id}`)}
                      />
                    </>
                  ) : (
                    <>
                      <RowAction
                        icon={note.pinned ? PinOffIcon : PinIcon}
                        label={note.pinned ? "Unpin" : "Pin"}
                        onClick={() => onTogglePin(note)}
                        pending={pending.has(`pin:${note.id}`)}
                      />
                      <RowAction
                        icon={Trash2Icon}
                        label="Move to trash"
                        danger
                        onClick={() => onTrash(note)}
                        pending={pending.has(`trash:${note.id}`)}
                      />
                    </>
                  )}
                </span>

                {/* A divider touching the selected row's tint reads as a stray
                    underline, so it drops out on both sides of the selection. */}
                {index < notes.length - 1 &&
                  !selected &&
                  !nextStartsSection &&
                  notes[index + 1]?.id !== selectedNoteId && (
                    <span aria-hidden className="mx-4 block h-px bg-border" />
                  )}
              </li>
              </Fragment>
            );
          })}
        </ul>
      )}

      {/* Phones: New note where a thumb is, not in the top corner (PRD R38.3). */}
      {!inTrash && (
        <Button
          size="icon"
          onClick={onCreate}
          disabled={pending.has("create")}
          aria-label="New note"
          data-ursa-fab=""
          className="ursa-fab-in absolute z-20 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 size-14 rounded-2xl bg-brand text-canvas shadow-[var(--shadow)] transition-transform duration-150 hover:bg-brand/90 active:scale-90 @[900px]:hidden [&_svg:not([class*='size-'])]:size-6"
        >
          {pending.has("create") ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
        </Button>
      )}
    </div>
  );
}

/**
 * Renders a search snippet with the matched terms marked (PRD R11.2).
 *
 * Offsets come from the server, so the text is sliced rather than re-searched —
 * re-finding the term in the client would be a second matching implementation
 * and would disagree about accents.
 */
function Highlighted({ match }: { match: SearchMatch }) {
  const pieces: React.ReactNode[] = [];
  let cursor = 0;

  for (const [from, to] of match.marks) {
    if (from < cursor || to > match.snippet.length) continue; // ignore overlaps
    if (from > cursor) pieces.push(match.snippet.slice(cursor, from));
    pieces.push(
      <mark key={`${from}-${to}`} className="rounded-[2px] bg-brand-soft px-px text-brand">
        {match.snippet.slice(from, to)}
      </mark>,
    );
    cursor = to;
  }
  if (cursor < match.snippet.length) pieces.push(match.snippet.slice(cursor));

  return <>{pieces}</>;
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
            className={active ? "bg-brand-soft text-brand" : "text-ink-soft"}
          >
            {pending ? <Loader2Icon className="animate-spin" /> : <Icon />}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function RowAction({
  icon: Icon,
  label,
  onClick,
  danger = false,
  pending = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
  pending?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon-xs"
            aria-label={label}
            aria-busy={pending}
            disabled={pending}
            onClick={onClick}
            className={`bg-raised shadow-sm ${danger ? "hover:text-brand" : ""}`}
          >
            {pending ? <Loader2Icon className="animate-spin" /> : <Icon />}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function EmptyState({
  inTrash,
  filter,
  colored,
  searching,
  onCreate,
}: {
  inTrash: boolean;
  filter: NoteFilter;
  colored: boolean;
  searching: boolean;
  onCreate: () => void;
}) {
  const [title, hint] = searching
    ? ["No notes match", "Try fewer or different words."]
    : colored
      ? ["No notes with this colour", "Give a note a colour from its ⋯ menu."]
      : inTrash
        ? ["Trash is empty", "Notes you delete wait here for a while."]
        : filter === "archive"
          ? ["Nothing archived", "Archive a finished note from its ⋯ menu to tidy the list without deleting it."]
          : filter === "templates"
            ? ["No templates yet", "Open a note and choose “Save as template” in its ⋯ menu."]
            : ["No notes yet", "Your first one is a tap away."];
  return (
    <div className="ursa-fade-in flex flex-1 flex-col items-center justify-center gap-3 px-6 pb-10 text-center">
      <Illustration kind={searching ? "search" : inTrash ? "trash" : "notes"} size={112} />
      <div className="flex flex-col gap-0.5">
        <p className="text-[0.88rem] font-semibold tracking-tight text-ink">{title}</p>
        <p className="text-[0.76rem] text-ink-faint">{hint}</p>
      </div>
      {filter !== "trash" && filter !== "archive" && filter !== "templates" && !searching && !colored && (
        <Button size="sm" onClick={onCreate}>
          <PlusIcon />
          New note
        </Button>
      )}
    </div>
  );
}

/**
 * The note's first image beside its row (PRD §4.51). Lazy, small, and gone
 * if it fails to load rather than a broken-image icon.
 */
function RowCover({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- private, session-gated attachments
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className="mt-0.5 size-12 flex-none rounded-lg border border-border bg-raised object-cover"
    />
  );
}

/**
 * To-do progress on a row (PRD §4.53): a small ring and "3/7", in the accent
 * colour once everything is ticked.
 */
function TodoChip({ done, total }: { done: number; total: number }) {
  const complete = done >= total;
  const r = 5;
  const c = 2 * Math.PI * r;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-px ${complete ? "bg-brand-soft text-brand" : "bg-raised text-ink-soft"}`}
      aria-label={`${done} of ${total} to-dos done`}
      title={`${done} of ${total} to-dos done`}
    >
      <svg viewBox="0 0 14 14" width="11" height="11" aria-hidden>
        <circle cx="7" cy="7" r={r} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
        <circle
          cx="7"
          cy="7"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${(done / total) * c} ${c}`}
          transform="rotate(-90 7 7)"
        />
      </svg>
      {done}/{total}
    </span>
  );
}

/** The swipe menu's "More": pin, share or copy, duplicate (PRD §4.52). */
function SwipeMore({
  note,
  canShare,
  onPin,
  onArchive,
  onAction,
  onDone,
}: {
  note: NoteListItem;
  canShare: boolean;
  onPin: () => void;
  onArchive: () => void;
  onAction: (kind: "copy" | "share" | "duplicate") => void;
  onDone: () => void;
}) {
  const run = (fn: () => void) => () => {
    onDone();
    fn();
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex flex-1 flex-col items-center justify-center gap-1 bg-[#8e8e93] text-[0.72rem] font-medium text-white active:brightness-90 [&_svg]:size-5"
          >
            <EllipsisIcon />
            More
          </button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem onClick={run(onPin)}>
          {note.pinned ? <PinOffIcon /> : <PinIcon />}
          {note.pinned ? "Unpin" : "Pin"}
        </DropdownMenuItem>
        {canShare && (
          <DropdownMenuItem onClick={run(() => onAction("share"))}>
            <ShareIcon />
            Share…
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={run(() => onAction("copy"))}>
          <CopyIcon />
          Copy as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={run(() => onAction("duplicate"))}>
          <CopyPlusIcon />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={run(onArchive)}>
          {note.archivedAt ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
          {note.archivedAt ? "Move back to Notes" : "Archive"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Roving focus within the list. */
export function moveFocusOnArrows(event: React.KeyboardEvent<HTMLElement>): void {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

  const rows = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-ursa-row]"));
  if (rows.length === 0) return;

  const index = rows.indexOf(document.activeElement as HTMLElement);
  const next = event.key === "ArrowDown" ? index + 1 : index - 1;
  const target = rows[Math.max(0, Math.min(rows.length - 1, next))];
  if (target) {
    event.preventDefault();
    target.focus();
  }
}
