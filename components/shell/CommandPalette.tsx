"use client";

import { FileTextIcon, HistoryIcon, SquareSlashIcon } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { displayExcerpt, displayTitle } from "@/lib/markdown/derive";
import type { NoteListItem } from "@/lib/types";

/**
 * ⌘K. Jumps to a note by title, or runs one of the shell's commands.
 *
 * Built on shadcn's Command (cmdk), which supplies the filtering, roving focus
 * and dialog semantics — the previous hand-rolled version reimplemented all
 * three and only the happy path was tested.
 *
 * Notes are matched against the titles already loaded in the list pane, so
 * opening the palette costs nothing and never waits on the network.
 */

export interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  notes: NoteListItem[];
  /** Recently opened notes, newest first, without the open one (PRD §4.57). */
  recent: NoteListItem[];
  commands: Command[];
  onSelectNote: (id: string) => void;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({
  open,
  notes,
  recent,
  commands,
  onSelectNote,
  onOpenChange,
}: CommandPaletteProps) {
  const choose = (run: () => void) => {
    onOpenChange(false);
    run();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Jump to a note, or run a command"
      showCloseButton={false}
    >
      {/* This CommandDialog renders children straight into the dialog without
          a cmdk root, so the Command context has to be supplied here. */}
      <Command>
        <CommandInput placeholder="Jump to a note, or run a command…" />
        <CommandList>
        <CommandEmpty>Nothing matches.</CommandEmpty>

        {recent.length > 0 && (
          <>
            <CommandGroup heading="Recent" data-ursa-private="">
              {recent.map((note) => (
                <CommandItem
                  key={`recent-${note.id}`}
                  value={`recent ${note.id} ${displayTitle(note.title)}`}
                  onSelect={() => choose(() => onSelectNote(note.id))}
                >
                  <HistoryIcon className="text-muted-foreground" />
                  <span className="truncate">{displayTitle(note.title)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Commands">
          {commands.map((command) => (
            <CommandItem
              key={command.id}
              value={`command ${command.label}`}
              onSelect={() => choose(command.run)}
            >
              <SquareSlashIcon className="text-muted-foreground" />
              <span>{command.label}</span>
              {command.hint && <CommandShortcut>{command.hint}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        {notes.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Notes" data-ursa-private="">
              {notes.slice(0, 50).map((note) => (
                <CommandItem
                  key={note.id}
                  value={`note ${displayTitle(note.title)} ${note.excerpt}`}
                  onSelect={() => choose(() => onSelectNote(note.id))}
                >
                  <FileTextIcon className="text-muted-foreground" />
                  <span className="truncate">{displayTitle(note.title)}</span>
                  {note.excerpt && (
                    <span className="ml-auto max-w-[45%] truncate text-xs text-muted-foreground">
                      {displayExcerpt(note.excerpt)}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
