"use client";

import { useEffect, useState } from "react";
import { ChevronRightIcon, HashIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TagNode } from "@/lib/markdown/tags";

/**
 * The tag tree (PRD §4.66): `#work/meetings` nests under `work`. Picking a
 * tag searches for it, which also finds everything nested below it. Read
 * fresh each time it opens, so it never shows tags that were edited away.
 */
export function TagTree({ onPick }: { onPick: (tag: string) => void }) {
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<TagNode[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setFailed(false);
    fetch("/api/tags")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((value: { tree: TagNode[] }) => !cancelled && setTree(value.tree))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [open]);

  const pick = (path: string) => {
    setOpen(false);
    onPick(`#${path}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Tags"
            title="Tags"
            className={open ? "bg-brand-soft text-brand" : "text-ink-faint"}
          >
            <HashIcon />
          </Button>
        }
      />
      <PopoverContent align="start" className="max-h-[min(var(--available-height),70dvh)] w-64 overflow-y-auto p-2">
        <p className="px-2 pb-1.5 pt-1 text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Tags</p>
        {failed ? (
          <p className="px-2 py-3 text-[0.8rem] text-ink-faint">Couldn’t load tags. Check your connection and open this again.</p>
        ) : tree === null ? (
          <div className="flex justify-center py-4 text-ink-faint">
            <Loader2Icon className="size-4 animate-spin" />
          </div>
        ) : tree.length === 0 ? (
          <p className="px-2 py-3 text-[0.8rem] text-ink-faint">
            No tags yet. Type <code className="rounded bg-raised px-1">#idea</code> or{" "}
            <code className="rounded bg-raised px-1">#work/meetings</code> in any note.
          </p>
        ) : (
          <ul role="tree" aria-label="Tags" data-ursa-private="">
            {tree.map((node) => (
              <Branch key={node.path} node={node} depth={0} onPick={pick} />
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Branch({ node, depth, onPick }: { node: TagNode; depth: number; onPick: (path: string) => void }) {
  const [expanded, setExpanded] = useState(depth === 0 && node.children.length <= 6);
  const hasChildren = node.children.length > 0;
  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined} aria-selected={false}>
      <div className="flex items-center rounded-md hover:bg-row-hover" style={{ paddingLeft: `${depth * 0.9}rem` }}>
        {hasChildren ? (
          <button
            type="button"
            aria-label={expanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            onClick={() => setExpanded((value) => !value)}
            className="grid size-6 flex-none place-items-center text-ink-faint hover:text-ink"
          >
            <ChevronRightIcon className={`size-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="size-6 flex-none" />
        )}
        <button
          type="button"
          onClick={() => onPick(node.path)}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-2 text-left text-[0.84rem]"
        >
          <span className="text-ink-faint">#</span>
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
          <span className="text-[0.72rem] tabular-nums text-ink-faint">{node.count}</span>
        </button>
      </div>
      {hasChildren && expanded && (
        <ul role="group">
          {node.children.map((child) => (
            <Branch key={child.path} node={child} depth={depth + 1} onPick={onPick} />
          ))}
        </ul>
      )}
    </li>
  );
}
