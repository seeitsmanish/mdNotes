"use client";

import type { EditorView } from "@codemirror/view";
import {
  BoldIcon,
  ChevronDownIcon,
  CodeIcon,
  HeadingIcon,
  HighlighterIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  type LucideIcon,
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
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

export function FormatBar({ view }: FormatBarProps) {
  if (!view) return null;

  const run = (command: (view: EditorView) => boolean) => {
    command(view);
    view.focus();
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-border bg-raised/95 px-1.5 py-1.5 shadow-[var(--shadow)] backdrop-blur">
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

        <Action icon={LinkIcon} label="Link (⌘K)" onClick={() => run(insertLink)} />
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
