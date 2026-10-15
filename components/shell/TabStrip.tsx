"use client";

import { useRef, useState } from "react";
import { LockIcon, PlusIcon, XIcon } from "lucide-react";

/**
 * A pane's tabs (PRD §4.80). Click to show, × or middle-click to close, drag
 * to reorder, + for a new note here. In a split, the strip of the pane notes
 * open into is marked, so it is clear where the next one will go.
 */
export function TabStrip({
  ids,
  active,
  focused,
  titleOf,
  lockedOf,
  onSelect,
  onClose,
  onReorder,
  onNew,
  trailing,
  label,
}: {
  ids: string[];
  active: string | null;
  /** This pane is where notes open (only meaningful in a split). */
  focused: boolean;
  titleOf: (id: string) => string;
  lockedOf: (id: string) => boolean;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onReorder: (id: string, to: number) => void;
  onNew?: () => void;
  trailing?: React.ReactNode;
  label: string;
}) {
  const dragging = useRef<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);

  return (
    <div
      role="tablist"
      aria-label={label}
      data-ursa-tabs=""
      data-focused={focused ? "" : undefined}
      className="ursa-tabs flex h-9 flex-none items-stretch border-b border-border bg-list"
    >
      <div
        className="flex min-w-0 flex-1 items-stretch overflow-x-auto"
        onDragOver={(event) => {
          if (dragging.current) event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (dragging.current && dropAt !== null) onReorder(dragging.current, dropAt);
          dragging.current = null;
          setDropAt(null);
        }}
      >
        {ids.map((id, index) => {
          const selected = id === active;
          const title = titleOf(id);
          return (
            <div
              key={id}
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              title={title}
              draggable
              data-ursa-tab=""
              data-active={selected ? "" : undefined}
              data-drop={dropAt === index ? "" : undefined}
              onDragStart={(event) => {
                dragging.current = id;
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(event) => {
                if (!dragging.current) return;
                const box = event.currentTarget.getBoundingClientRect();
                setDropAt(event.clientX < box.left + box.width / 2 ? index : index + 1);
              }}
              onDragEnd={() => {
                dragging.current = null;
                setDropAt(null);
              }}
              onClick={() => onSelect(id)}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  onClose(id);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(id);
                } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                  const next = ids[index + (event.key === "ArrowRight" ? 1 : -1)];
                  if (next) {
                    onSelect(next);
                    requestAnimationFrame(() =>
                      (event.currentTarget.parentElement?.querySelector("[data-active]") as HTMLElement | null)?.focus(),
                    );
                  }
                } else if (event.key === "Delete" || event.key === "Backspace") {
                  event.preventDefault();
                  onClose(id);
                }
              }}
              className="ursa-tab group relative flex max-w-52 min-w-24 flex-none cursor-pointer items-center gap-1.5 border-r border-border pl-3 pr-1 text-[0.78rem] text-ink-faint outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/60"
            >
              {lockedOf(id) && <LockIcon className="size-3 flex-none" aria-label="Locked" />}
              <span data-ursa-private="" className="ursa-private-text min-w-0 flex-1 truncate">
                {title}
              </span>
              <button
                type="button"
                tabIndex={-1}
                aria-label={`Close ${title}`}
                title="Close tab (middle-click)"
                onClick={(event) => {
                  event.stopPropagation();
                  onClose(id);
                }}
                className={`grid size-5 flex-none cursor-pointer place-items-center rounded text-ink-faint hover:bg-ink/10 hover:text-ink ${
                  selected ? "" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                }`}
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          );
        })}
        {onNew && (
          <button
            type="button"
            onClick={onNew}
            aria-label="New note in a new tab"
            title="New note in a new tab"
            className="grid w-9 flex-none cursor-pointer place-items-center text-ink-faint hover:text-ink"
          >
            <PlusIcon className="size-4" />
          </button>
        )}
      </div>
      {trailing}
    </div>
  );
}
