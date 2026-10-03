"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2Icon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as api from "@/lib/api";
import { diffLines } from "@/lib/history/diff";
import { relativeTime } from "@/lib/time";
import type { NoteDetail } from "@/lib/types";

/**
 * Earlier versions of the open note (PRD §4.28): pick one, see what it would
 * bring back, restore it. Restoring keeps the current text as a version
 * first, so nothing done here is final.
 */
export function HistoryDialog({
  open,
  onOpenChange,
  noteId,
  currentBody,
  onRestored,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string | null;
  /** The editor's text right now, to compare versions against. */
  currentBody: string;
  onRestored: (note: NoteDetail) => void;
}) {
  const [revisions, setRevisions] = useState<api.RevisionSummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !noteId) return;
    let cancelled = false;
    setRevisions(null);
    setSelected(null);
    setBody(null);
    setFailed(null);
    api
      .fetchHistory(noteId)
      .then(({ revisions: list }) => {
        if (cancelled) return;
        setRevisions(list);
        setSelected(list[0]?.id ?? null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setFailed(error instanceof Error ? error.message : "Could not load history.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, noteId]);

  useEffect(() => {
    if (!noteId || !selected) return;
    let cancelled = false;
    setBody(null);
    api
      .fetchRevision(noteId, selected)
      .then(({ revision }) => !cancelled && setBody(revision.body))
      .catch(() => !cancelled && setBody(""));
    return () => {
      cancelled = true;
    };
  }, [noteId, selected]);

  const diff = useMemo(() => (body === null ? null : diffLines(body, currentBody)), [body, currentBody]);
  const chosen = revisions?.find((r) => r.id === selected) ?? null;

  const restore = async () => {
    if (!noteId || !selected || restoring) return;
    setRestoring(true);
    try {
      const { note } = await api.restoreRevision(noteId, selected);
      onRestored(note);
      onOpenChange(false);
      toast(`Restored the version from ${chosen ? relativeTime(chosen.createdAt) : "earlier"}.`, {
        description: "The text it replaced is kept in history.",
      });
    } catch (error) {
      toast.error("Couldn’t restore that version.", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-4xl" data-ursa-history="">
        <DialogHeader>
          <DialogTitle>History</DialogTitle>
          <DialogDescription>
            Earlier versions of this note. A version is kept every ten minutes while you write, and always
            before a change that removes most of the note.
          </DialogDescription>
        </DialogHeader>

        {failed && <p className="text-[0.85rem] text-destructive">{failed}</p>}
        {!failed && revisions === null && (
          <p className="flex items-center gap-2 text-[0.85rem] text-ink-faint">
            <Loader2Icon className="size-4 animate-spin" /> Loading history…
          </p>
        )}
        {revisions && revisions.length === 0 && (
          <p className="text-[0.85rem] text-ink-soft">
            No earlier versions yet. They start being kept as you edit this note.
          </p>
        )}

        {revisions && revisions.length > 0 && (
          <div className="grid min-h-0 flex-1 gap-3 sm:grid-cols-[14rem_1fr]">
            <ol className="flex max-h-40 flex-col gap-0.5 overflow-y-auto sm:max-h-none">
              {revisions.map((revision) => (
                <li key={revision.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(revision.id)}
                    title={new Date(revision.createdAt).toLocaleString()}
                    className={`w-full rounded-lg px-3 py-2 text-left text-[0.8rem] ${
                      revision.id === selected ? "bg-brand-soft text-brand" : "text-ink-soft hover:bg-raised"
                    }`}
                  >
                    <span className="block font-medium">{relativeTime(revision.createdAt)}</span>
                    <span className="block truncate text-[0.72rem] text-ink-faint">
                      {revision.words} words · {revision.title || "Untitled"}
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            <div className="flex min-h-0 flex-col gap-2">
              <div className="flex items-center gap-2 text-[0.75rem] text-ink-faint">
                {diff?.compared && (
                  <span>
                    {diff.removed === 0 && diff.added === 0
                      ? "Same as now"
                      : `Brings back ${diff.removed} line${diff.removed === 1 ? "" : "s"} · drops ${diff.added} you have now`}
                  </span>
                )}
                <Button
                  size="sm"
                  className="ml-auto"
                  disabled={!selected || body === null || restoring}
                  onClick={() => void restore()}
                >
                  {restoring ? <Loader2Icon className="animate-spin" /> : <RotateCcwIcon />}
                  Restore this version
                </Button>
              </div>
              <pre className="min-h-40 flex-1 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-raised p-3 font-sans text-[0.82rem] leading-relaxed text-ink-soft">
                {body === null
                  ? "…"
                  : body.split("\n").map((line, index) => (
                      <span
                        // Lines are positional; index is the identity.
                        key={index}
                        className={diff?.goneNow[index] ? "-mx-3 block bg-brand-soft px-3 text-heading" : "block"}
                        data-gone={diff?.goneNow[index] ? "" : undefined}
                      >
                        {line || " "}
                      </span>
                    ))}
              </pre>
              <p className="text-[0.7rem] text-ink-faint">Highlighted lines are not in the note now.</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
