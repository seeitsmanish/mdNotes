"use client";

import { useEffect, useState } from "react";
import { CornerUpLeftIcon } from "lucide-react";
import { displayTitle } from "@/lib/markdown/derive";

/**
 * Which notes link *to* this one (PRD R10.5).
 *
 * This is the half of linking that is worth having — forward links you already
 * know about, because you typed them.
 */

interface Backlink {
  id: string;
  title: string;
  excerpt: string;
}

export function Backlinks({
  noteId,
  onOpen,
}: {
  noteId: string | null;
  onOpen: (id: string) => void;
}) {
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);

  useEffect(() => {
    if (!noteId) {
      setBacklinks([]);
      return;
    }

    let cancelled = false;
    fetch(`/api/notes/${noteId}/backlinks`)
      .then((response) => (response.ok ? response.json() : { backlinks: [] }))
      .then((data: { backlinks?: Backlink[] }) => {
        if (!cancelled) setBacklinks(data.backlinks ?? []);
      })
      .catch(() => {
        // Backlinks are additive context; failing to load them must not
        // interrupt writing.
        if (!cancelled) setBacklinks([]);
      });

    return () => {
      cancelled = true;
    };
  }, [noteId]);

  // Nothing links here yet: say nothing rather than showing an empty shelf.
  if (backlinks.length === 0) return null;

  return (
    <aside className="flex-none border-t border-border bg-list/60 px-4 py-2">
      <div className="mx-auto flex w-full max-w-(--editor-measure) flex-wrap items-center gap-x-2 gap-y-1">
        <span className="flex items-center gap-1 text-[0.68rem] font-medium uppercase tracking-wider text-ink-faint">
          <CornerUpLeftIcon size={11} />
          Linked from
        </span>
        {backlinks.map((note) => (
          <button
            key={note.id}
            type="button"
            onClick={() => onOpen(note.id)}
            title={note.excerpt}
            className="max-w-56 truncate rounded-md px-1.5 py-0.5 text-[0.74rem] text-brand transition-colors hover:bg-brand-soft"
          >
            {displayTitle(note.title)}
          </button>
        ))}
      </div>
    </aside>
  );
}
