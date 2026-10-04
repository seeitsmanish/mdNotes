"use client";

import { useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import {
  BoldIcon,
  ChevronDownIcon,
  CodeIcon,
  HeadingIcon,
  HighlighterIcon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  type LucideIcon,
  SmileIcon,
  SquareCheckIcon,
  TableIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { EMOJI_GROUPS } from "@/lib/emoji/emoji";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { insertImages } from "./imagePaste";
import {
  insertCodeBlock,
  insertLink,
  insertTable,
  setHeading,
  toggleBold,
  toggleBullet,
  toggleHighlight,
  toggleItalic,
  toggleQuote,
  toggleTodo,
} from "./commands";

/**
 * The floating format bar.
 *
 * It exists for the things that are awkward to type rather than as a
 * replacement for the markup — a single-pane editor is still driven by text, so
 * every control here writes the same characters the keyboard would.
 */

interface FormatBarProps {
  view: EditorView | null;
}

/**
 * How far the on-screen keyboard covers the bottom of the layout viewport, in
 * px (PRD R26.4). Mobile browsers overlay the keyboard rather than resizing
 * the page, so a bar pinned to the bottom ends up underneath it; the visual
 * viewport says how much of the page is actually showing.
 */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;
      // Small differences are browser chrome sliding, not a keyboard.
      setInset(covered > 80 ? Math.round(covered) : 0);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

/**
 * Which ends of a sideways-scrolling strip have more to show. The fade that
 * hints at more must follow the scroll: a fixed one at the right edge left the
 * last buttons faded out even once scrolled all the way to them.
 */
function useScrollEdges(mounted: unknown) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const start = el.scrollLeft > 1;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [mounted]);
  return { ref, edges };
}

export function FormatBar({ view }: FormatBarProps) {
  const filePicker = useRef<HTMLInputElement | null>(null);
  const keyboardInset = useKeyboardInset();
  const strip = useScrollEdges(view);
  if (!view) return null;

  const run = (command: (view: EditorView) => boolean) => {
    command(view);
    view.focus();
  };

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-4"
      style={keyboardInset ? { bottom: `calc(0.5rem + ${keyboardInset}px)` } : undefined}
    >
      <div
        ref={strip.ref}
        data-more-start={strip.edges.start ? "" : undefined}
        data-more-end={strip.edges.end ? "" : undefined}
        className="ursa-format-bar pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-border bg-raised/95 px-1.5 py-1.5 shadow-[var(--shadow)] backdrop-blur">
        <Menu icon={HeadingIcon} label="Headings">
          {[1, 2, 3].map((level) => (
            <DropdownMenuItem key={level} onClick={() => run(setHeading(level))}>
              <span
                className="font-semibold"
                style={{ fontSize: `${1.1 - (level - 1) * 0.12}rem` }}
              >
                Heading {level}
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onClick={() => run(toggleQuote)}>Quote</DropdownMenuItem>
        </Menu>

        <Action icon={SquareCheckIcon} label="To-do (⌘⇧7)" onClick={() => run(toggleTodo)} />

        <Menu icon={ListIcon} label="Lists">
          <DropdownMenuItem onClick={() => run(toggleBullet)}>Bulleted list</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run(toggleTodo)}>To-do</DropdownMenuItem>
        </Menu>

        <Separator orientation="vertical" className="mx-1 !h-4" />

        <Action icon={BoldIcon} label="Bold (⌘B)" onClick={() => run(toggleBold)} />
        <Action icon={ItalicIcon} label="Italic (⌘I)" onClick={() => run(toggleItalic)} />
        <Action icon={HighlighterIcon} label="Highlight (⌘⇧H)" onClick={() => run(toggleHighlight)} />

        <Separator orientation="vertical" className="mx-1 !h-4" />

        <Action icon={LinkIcon} label="Link (⌘⇧K)" onClick={() => run(insertLink)} />
        <Action icon={ImageIcon} label="Image — or paste / drop one" onClick={() => filePicker.current?.click()} />
        <input
          ref={filePicker}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/heic,image/avif"
          multiple
          hidden
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = "";
            if (files.length > 0) insertImages(view, files);
            view.focus();
          }}
        />
        <EmojiPicker
          onPick={(emoji) => {
            view.dispatch(view.state.replaceSelection(emoji), { userEvent: "input" });
            view.focus();
          }}
        />
        <Action icon={TableIcon} label="Table" onClick={() => run(insertTable)} />
        <Action icon={CodeIcon} label="Code block" onClick={() => run(insertCodeBlock)} />
      </div>
    </div>
  );
}

function Action({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            // Keep focus in the document so commands apply to a live selection.
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
            className="text-ink-soft"
          >
            <Icon />
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function Menu({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={label}
            onMouseDown={(event) => event.preventDefault()}
            className="gap-0.5 px-1.5 text-ink-soft"
          >
            <Icon />
            <ChevronDownIcon className="opacity-60" />
          </Button>
        }
      />
      <DropdownMenuContent align="center" side="top" className="min-w-44">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * A tappable emoji grid (PRD §4.49) — on a phone, typing `:fire` is slower
 * than finding the flame. Grouped, scrollable, and it keeps the caret: focus
 * returns to the note with the emoji inserted where it was.
 */
function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Emoji"
            onMouseDown={(event) => event.preventDefault()}
            className={open ? "bg-brand-soft text-brand" : "text-ink-soft"}
          >
            <SmileIcon />
          </Button>
        }
      />
      <PopoverContent
        side="top"
        align="center"
        className="ursa-emoji-picker max-h-[min(20rem,var(--available-height))] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain p-2"
        initialFocus={false}
      >
        {EMOJI_GROUPS.map((group) => (
          <section key={group.name} className="mb-2 last:mb-0">
            <h3 className="sticky top-0 z-10 bg-popover/95 px-1 pb-1 pt-0.5 text-[0.64rem] font-semibold uppercase tracking-wider text-ink-faint backdrop-blur">
              {group.name}
            </h3>
            <div className="grid grid-cols-8 gap-0.5">
              {group.items.map((emoji) => (
                <button
                  key={emoji.n}
                  type="button"
                  title={`:${emoji.n}`}
                  aria-label={emoji.n.replace(/_/g, " ")}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onPick(emoji.e);
                    setOpen(false);
                  }}
                  className="flex aspect-square items-center justify-center rounded-md text-[1.3rem] leading-none transition-transform duration-100 hover:scale-110 hover:bg-raised active:scale-95"
                >
                  {emoji.e}
                </button>
              ))}
            </div>
          </section>
        ))}
      </PopoverContent>
    </Popover>
  );
}
