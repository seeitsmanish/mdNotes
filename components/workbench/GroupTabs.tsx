"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  Columns2Icon,
  EllipsisIcon,
  LockIcon,
  Maximize2Icon,
  Minimize2Icon,
  PinIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUiStore } from "@/lib/store/useUiStore";
import type { Group } from "@/lib/workbench/group";
import { PRESETS, type Side } from "@/lib/workbench/layout";
import * as W from "@/lib/workbench/workbench";
import { currentDrag, endDrag, startDrag, wantsCopy } from "./drag";

const run = (action: (wb: W.Workbench) => W.Workbench) => useUiStore.getState().workbench(action);

export interface TabInfo {
  titleOf: (id: string) => string;
  lockedOf: (id: string) => boolean;
  /** Has text not yet saved: the tab shows a dot instead of × (VS Code's dirty mark). */
  dirtyOf: (id: string) => boolean;
  /** A new note in this group (+, or a double-click on the empty strip). */
  onNewNote: (group: string) => void;
  /** Copy `[[Title]]` for pasting into another note. */
  onCopyLink: (id: string) => void;
}

const SIDES: Array<{ side: Side; label: string }> = [
  { side: "up", label: "Split Up" },
  { side: "down", label: "Split Down" },
  { side: "left", label: "Split Left" },
  { side: "right", label: "Split Right" },
];

/**
 * One editor group's tab strip (PRD §4.81). Mouse: click to show, double-
 * click to keep a preview or maximise the group, middle-click to close, drag
 * to reorder or to another group, right-click for the tab's menu. The
 * strip's own buttons split the group and open the group's menu.
 */
export function GroupTabs({
  group,
  isActive,
  groupCount,
  maximized,
  info,
}: {
  group: Group;
  isActive: boolean;
  groupCount: number;
  maximized: boolean;
  info: TabInfo;
}) {
  const [menuTab, setMenuTab] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // The shown tab scrolls into view when it changes, as VS Code's does.
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>("[data-ursa-tab][data-active]");
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [group.active]);

  const indexAt = (event: React.DragEvent, index: number) => {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return event.clientX < box.left + box.width / 2 ? index : index + 1;
  };

  const onDrop = (event: React.DragEvent) => {
    const drag = currentDrag(event);
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    const index = dropAt ?? group.tabs.length;
    setDropAt(null);
    endDrag();
    if (drag.group === null) {
      useUiStore.getState().openNote(drag.note, { group: group.id, index });
    } else {
      run((wb) => W.moveTab(wb, drag.group!, drag.note, group.id, { index, copy: wantsCopy(event) }));
    }
  };

  const ids = group.tabs;
  const neighbourGroups = (id: string) => ({
    next: W.adjacentGroup(useUiStore.getState().wb, group.id, 1),
    previous: W.adjacentGroup(useUiStore.getState().wb, group.id, -1),
    id,
  });

  return (
    <div
      data-ursa-tabs=""
      data-focused={isActive && groupCount > 1 ? "" : undefined}
      className="ursa-tabs flex h-9 flex-none items-stretch border-b border-border bg-list"
    >
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <div
              ref={scroller}
              role="tablist"
              aria-label="Open notes"
              className="ursa-tab-scroller flex min-w-0 flex-1 items-stretch overflow-x-auto"
              onWheel={(event) => {
                // A mouse wheel scrolls the strip sideways, as in VS Code.
                if (event.deltaY && !event.deltaX && scroller.current) scroller.current.scrollLeft += event.deltaY;
              }}
              onContextMenu={(event) => {
                if (!(event.target as HTMLElement).closest("[data-ursa-tab]")) setMenuTab(null);
              }}
              onDoubleClick={(event) => {
                if (!(event.target as HTMLElement).closest("[data-ursa-tab]")) info.onNewNote(group.id);
              }}
              onDragOver={(event) => {
                if (!currentDrag(event)) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = wantsCopy(event) ? "copy" : "move";
                if (event.target === event.currentTarget) setDropAt(ids.length);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropAt(null);
              }}
              onDrop={onDrop}
            />
          }
        >
          {ids.map((id, index) => {
            const selected = id === group.active;
            const title = info.titleOf(id);
            const pinned = group.pinned.includes(id);
            const preview = group.preview === id;
            const dirty = info.dirtyOf(id);
            return (
              <div
                key={id}
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                title={preview ? `${title} (preview — edit or double-click to keep)` : title}
                draggable
                data-ursa-tab=""
                data-active={selected ? "" : undefined}
                data-preview={preview ? "" : undefined}
                data-pinned={pinned ? "" : undefined}
                data-drop={dropAt === index ? "" : undefined}
                data-drop-end={dropAt === ids.length && index === ids.length - 1 ? "" : undefined}
                onMouseDown={(event) => {
                  if (event.button === 0) run((wb) => W.activateTab(wb, group.id, id));
                }}
                onDoubleClick={() => {
                  if (preview) run((wb) => W.keepTab(wb, group.id, id));
                  else run((wb) => W.toggleMaximize(wb, group.id));
                }}
                onAuxClick={(event) => {
                  if (event.button === 1) {
                    event.preventDefault();
                    run((wb) => W.closeTab(wb, group.id, id));
                  }
                }}
                onContextMenu={() => setMenuTab(id)}
                onDragStart={(event) => startDrag(event, { note: id, group: group.id }, title)}
                onDragEnd={() => {
                  endDrag();
                  setDropAt(null);
                }}
                onDragOver={(event) => {
                  if (!currentDrag(event)) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = wantsCopy(event) ? "copy" : "move";
                  setDropAt(indexAt(event, index));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    run((wb) => W.activateTab(wb, group.id, id));
                  } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                    event.preventDefault();
                    const next = ids[index + (event.key === "ArrowRight" ? 1 : -1)];
                    if (next) {
                      run((wb) => W.activateTab(wb, group.id, next));
                      requestAnimationFrame(() =>
                        scroller.current?.querySelector<HTMLElement>("[data-ursa-tab][data-active]")?.focus(),
                      );
                    }
                  } else if (event.key === "Delete") {
                    event.preventDefault();
                    run((wb) => W.closeTab(wb, group.id, id));
                  }
                }}
                className="ursa-tab group/tab relative flex max-w-56 min-w-0 flex-none cursor-pointer select-none items-center gap-1.5 border-r border-border pl-3 pr-1 text-[0.78rem] text-ink-faint outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/60"
              >
                {info.lockedOf(id) && <LockIcon className="size-3 flex-none" aria-label="Locked" />}
                <span data-ursa-private="" className={`ursa-private-text min-w-0 flex-1 truncate ${preview ? "italic" : ""}`}>
                  {title}
                </span>
                {pinned ? (
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={`Unpin ${title}`}
                    title="Unpin"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      run((wb) => W.unpinTab(wb, group.id, id));
                    }}
                    className="grid size-5 flex-none cursor-pointer place-items-center rounded text-ink-faint hover:bg-ink/10 hover:text-ink"
                  >
                    <PinIcon className="size-3" />
                  </button>
                ) : (
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={`Close ${title}`}
                    title={dirty ? "Saving… (close)" : "Close (⌥W)"}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      run((wb) => W.closeTab(wb, group.id, id));
                    }}
                    data-dirty={dirty ? "" : undefined}
                    className={`ursa-tab-close grid size-5 flex-none cursor-pointer place-items-center rounded text-ink-faint hover:bg-ink/10 hover:text-ink ${
                      selected || dirty ? "" : "opacity-0 group-hover/tab:opacity-100 focus-visible:opacity-100"
                    }`}
                  >
                    <XIcon className="ursa-tab-x size-3.5" />
                    <span aria-hidden className="ursa-tab-dot size-2 rounded-full bg-current" />
                  </button>
                )}
              </div>
            );
          })}
        </ContextMenuTrigger>
        <ContextMenuContent>
          {menuTab ? (
            <TabMenu group={group} id={menuTab} info={info} neighbours={neighbourGroups(menuTab)} />
          ) : (
            <GroupMenuItems group={group} groupCount={groupCount} maximized={maximized} info={info} />
          )}
        </ContextMenuContent>
      </ContextMenu>

      <div className="flex flex-none items-center gap-0.5 px-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="New note in this group"
          title="New note in this group"
          onClick={() => info.onNewNote(group.id)}
          className="text-ink-faint"
        >
          <PlusIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Split editor right"
          title="Split Editor Right (⌘\) — ⌥-click: down"
          onClick={(event) =>
            run((wb) =>
              W.split(wb, group.id, event.altKey ? "down" : "right", { note: group.active ?? undefined }),
            )
          }
          className="text-ink-faint"
        >
          <Columns2Icon />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="Group actions" title="Group actions" className="text-ink-faint">
                <EllipsisIcon />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-56">
            <GroupMenuItems group={group} groupCount={groupCount} maximized={maximized} info={info} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function TabMenu({
  group,
  id,
  info,
  neighbours,
}: {
  group: Group;
  id: string;
  info: TabInfo;
  neighbours: { next: string | null; previous: string | null };
}) {
  const pinned = group.pinned.includes(id);
  const at = group.tabs.indexOf(id);
  return (
    <>
      <DropdownMenuItem onClick={() => run((wb) => W.closeTab(wb, group.id, id))}>
        Close
        <DropdownMenuShortcut>⌥W</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem disabled={group.tabs.length < 2} onClick={() => run((wb) => W.closeOthers(wb, group.id, id))}>
        Close Others
      </DropdownMenuItem>
      <DropdownMenuItem disabled={at === group.tabs.length - 1} onClick={() => run((wb) => W.closeToRight(wb, group.id, id))}>
        Close to the Right
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => run((wb) => W.closeAllInGroup(wb, group.id))}>
        Close All
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => run((wb) => W.reopenClosed(wb))}>
        Reopen Closed Tab
        <DropdownMenuShortcut>⌥⇧T</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {group.preview === id && (
        <DropdownMenuItem onClick={() => run((wb) => W.keepTab(wb, group.id, id))}>
          Keep Open
          <DropdownMenuShortcut>⌘K ⏎</DropdownMenuShortcut>
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onClick={() => run((wb) => (pinned ? W.unpinTab(wb, group.id, id) : W.pinTab(wb, group.id, id)))}>
        {pinned ? "Unpin" : "Pin"}
        <DropdownMenuShortcut>⌘K ⇧⏎</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {SIDES.map(({ side, label }) => (
        <DropdownMenuItem key={side} onClick={() => run((wb) => W.split(wb, group.id, side, { note: id }))}>
          {label}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>Move to…</DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="min-w-52">
          {neighbours.next && (
            <DropdownMenuItem onClick={() => run((wb) => W.moveTab(wb, group.id, id, neighbours.next!))}>
              Next Group
              <DropdownMenuShortcut>⌃⌘→</DropdownMenuShortcut>
            </DropdownMenuItem>
          )}
          {neighbours.previous && (
            <DropdownMenuItem onClick={() => run((wb) => W.moveTab(wb, group.id, id, neighbours.previous!))}>
              Previous Group
              <DropdownMenuShortcut>⌃⌘←</DropdownMenuShortcut>
            </DropdownMenuItem>
          )}
          {SIDES.map(({ side }) => (
            <DropdownMenuItem key={side} onClick={() => run((wb) => W.sendTab(wb, group.id, id, side))}>
              Group {side === "up" ? "Above" : side === "down" ? "Below" : side === "left" ? "on the Left" : "on the Right"}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => info.onCopyLink(id)}>Copy Link to Note</DropdownMenuItem>
    </>
  );
}

/** The group's own menu: on the ⋯ button, and on a right-click beside the tabs. */
export function GroupMenuItems({
  group,
  groupCount,
  maximized,
  info,
}: {
  group: Group;
  groupCount: number;
  maximized: boolean;
  info: TabInfo;
}) {
  return (
    <>
      <DropdownMenuItem onClick={() => info.onNewNote(group.id)}>
        New Note in Group
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {SIDES.map(({ side, label }) => (
        <DropdownMenuItem
          key={side}
          onClick={() => run((wb) => W.split(wb, group.id, side, { note: group.active ?? undefined }))}
        >
          {label}
          {side === "right" && <DropdownMenuShortcut>⌘\</DropdownMenuShortcut>}
          {side === "down" && <DropdownMenuShortcut>⌘K ⌘\</DropdownMenuShortcut>}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled={group.tabs.length === 0} onClick={() => run((wb) => W.closeAllInGroup(wb, group.id))}>
        Close All in Group
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => run((wb) => W.closeGroup(wb, group.id))}>
        Close Group
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => run((wb) => W.reopenClosed(wb))}>
        Reopen Closed Tab
        <DropdownMenuShortcut>⌥⇧T</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => run((wb) => W.toggleLock(wb, group.id))}>
        {group.locked ? <CheckIcon /> : <span className="size-4" />}
        Lock Group
      </DropdownMenuItem>
      {groupCount > 1 && (
        <>
          <DropdownMenuItem onClick={() => run((wb) => W.toggleMaximize(wb, group.id))}>
            {maximized ? <Minimize2Icon /> : <Maximize2Icon />}
            {maximized ? "Restore Group Sizes" : "Maximize Group"}
            <DropdownMenuShortcut>⌘K ⌘M</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run(W.even)}>Make Groups Even</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run((wb) => W.joinGroup(wb, group.id))}>Join with Next Group</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run(W.joinAll)}>Join All Groups</DropdownMenuItem>
        </>
      )}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>Editor Layout</DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="min-w-52">
          {PRESETS.map((preset) => (
            <DropdownMenuItem key={preset.value} onClick={() => run((wb) => W.applyPreset(wb, preset.value))}>
              {preset.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => run(W.flipLayout)}>
            Flip Layout
            <DropdownMenuShortcut>⌥⌘0</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      {group.tabs.length > 0 && (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Open Notes in Group</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-80 min-w-52">
            {group.tabs.map((id) => (
              <DropdownMenuItem key={id} onClick={() => run((wb) => W.activateTab(wb, group.id, id))}>
                {id === group.active ? <CheckIcon /> : <span className="size-4" />}
                <span data-ursa-private="" className="ursa-private-text truncate">
                  {info.titleOf(id)}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )}
    </>
  );
}
