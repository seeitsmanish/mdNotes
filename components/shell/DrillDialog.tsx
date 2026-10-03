"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Question } from "@/lib/drill/questions";
import {
  type Memories,
  type Rating,
  order,
  parseMemories,
  rate,
  tally,
} from "@/lib/drill/schedule";

/**
 * Drill mode (PRD §4.23): a note's questions, one at a time, weakest first,
 * with a clock — because the answer you can give in two minutes out loud is
 * the one that counts in an interview.
 *
 * Ratings live in this browser's storage: they are about how *you* are doing
 * on this device, not part of the note, and need no server.
 */

const STORAGE_KEY = "ursa.drill.v1";
/** Past this, the clock turns amber: an answer that long is losing the room. */
const ANSWER_BUDGET_S = 120;

function loadMemories(): Memories {
  try {
    return parseMemories(localStorage.getItem(STORAGE_KEY));
  } catch {
    return {};
  }
}

function saveMemories(memories: Memories): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
  } catch {
    // Private mode or full storage: the session still works, it just will
    // not be remembered.
  }
}

const RATINGS: Array<{ rating: Rating; label: string; key: string }> = [
  { rating: "blank", label: "Blanked", key: "1" },
  { rating: "shaky", label: "Shaky", key: "2" },
  { rating: "nailed", label: "Nailed it", key: "3" },
];

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function DrillDialog({
  open,
  onOpenChange,
  title,
  questions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  questions: Question[];
}) {
  const [queue, setQueue] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<Array<{ question: Question; rating: Rating }>>([]);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [memories, setMemories] = useState<Memories>({});
  /** Standing when the session began — the summary compares against it. */
  const [before, setBefore] = useState(() => tally([], {}, 0));

  const start = useCallback((pool: Question[]) => {
    const stored = loadMemories();
    setMemories(stored);
    setBefore(tally(pool, stored, Date.now()));
    setQueue(order(pool, stored, Date.now()));
    setIndex(0);
    setRevealed(false);
    setResults([]);
    setStartedAt(Date.now());
  }, []);

  // A fresh session every time the dialog opens.
  useEffect(() => {
    if (open) start(questions);
  }, [open, questions, start]);

  const current = queue[index];
  const finished = open && queue.length > 0 && index >= queue.length;

  useEffect(() => {
    if (!open || finished) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open, finished]);

  const record = useCallback(
    (rating: Rating) => {
      if (!current) return;
      const at = Date.now();
      setMemories((prev) => {
        const next = { ...prev, [current.id]: rate(prev[current.id], rating, at) };
        saveMemories(next);
        return next;
      });
      setResults((prev) => [...prev, { question: current, rating }]);
      setIndex((i) => i + 1);
      setRevealed(false);
      setStartedAt(at);
      setNow(at);
    },
    [current],
  );

  useEffect(() => {
    if (!open || finished) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      const choice = RATINGS.find((r) => r.key === event.key);
      if (choice) {
        event.preventDefault();
        record(choice.rating);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finished, record]);

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const overBudget = elapsed >= ANSWER_BUDGET_S;
  const weak = results.filter((r) => r.rating !== "nailed").map((r) => r.question);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-ursa-drill="">
        <DialogHeader>
          <DialogTitle>Drill · {title}</DialogTitle>
          <DialogDescription>
            {finished
              ? "Session done."
              : `${Math.min(index + 1, queue.length)} of ${queue.length} · weakest first · Space reveals your notes · 1 2 3 to rate`}
          </DialogDescription>
        </DialogHeader>

        {current && !finished && (
          <div className="flex flex-col gap-5">
            <div className="h-1 overflow-hidden rounded-full bg-raised">
              <div
                className="h-full bg-brand transition-[width] duration-300"
                style={{ width: `${(index / queue.length) * 100}%` }}
              />
            </div>

            <p className="text-[1.3rem] font-semibold leading-snug tracking-tight text-heading">
              {current.prompt}
            </p>

            <div className="flex items-center gap-3 text-[0.78rem] text-ink-faint">
              <span
                className={`font-mono tabular-nums ${overBudget ? "text-destructive" : ""}`}
                aria-label="Time on this question"
              >
                {clock(elapsed)}
              </span>
              {overBudget && <span className="text-destructive">Over two minutes — wrap up.</span>}
              <span className="ml-auto">
                {memoryLabel(memories[current.id]?.rating)}
              </span>
            </div>

            {revealed ? (
              <div className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-raised px-4 py-3 text-[0.9rem] leading-relaxed text-ink-soft">
                {current.detail || "No notes under this question yet — say your answer out loud, then rate it."}
              </div>
            ) : (
              <Button variant="outline" onClick={() => setRevealed(true)} className="self-start">
                {current.detail ? "Reveal my notes" : "No notes yet"} <kbd className="ml-2 text-ink-faint">Space</kbd>
              </Button>
            )}

            <div className="grid grid-cols-3 gap-2">
              {RATINGS.map((r) => (
                <Button
                  key={r.rating}
                  variant={r.rating === "nailed" ? "default" : "outline"}
                  onClick={() => record(r.rating)}
                >
                  {r.label} <kbd className="ml-2 opacity-60">{r.key}</kbd>
                </Button>
              ))}
            </div>
          </div>
        )}

        {finished && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              {RATINGS.map((r) => (
                <div key={r.rating} className="rounded-lg border border-border bg-raised px-3 py-3">
                  <div className="text-[1.5rem] font-semibold tabular-nums text-heading">
                    {results.filter((x) => x.rating === r.rating).length}
                  </div>
                  <div className="text-[0.75rem] text-ink-faint">{r.label}</div>
                </div>
              ))}
            </div>

            {weak.length > 0 && (
              <div>
                <h3 className="mb-2 text-[0.68rem] font-semibold uppercase tracking-wider text-ink-faint">
                  Work on these
                </h3>
                <ol className="flex list-decimal flex-col gap-1 pl-5 text-[0.85rem] text-ink-soft">
                  {weak.map((q) => (
                    <li key={q.id}>{q.prompt}</li>
                  ))}
                </ol>
              </div>
            )}

            <p className="text-[0.75rem] text-ink-faint">
              Before this session: {before.nailed} nailed, {before.shaky} shaky, {before.blank} blanked,{" "}
              {before.unseen} never asked. Ratings are kept on this device.
            </p>

            <div className="flex gap-2">
              {weak.length > 0 && <Button onClick={() => start(weak)}>Drill the {weak.length} again</Button>}
              <Button variant="outline" onClick={() => start(questions)}>
                Start over
              </Button>
              <Button variant="ghost" className="ml-auto" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function memoryLabel(rating: Rating | undefined): string {
  if (!rating) return "New question";
  if (rating === "blank") return "Last time: blanked";
  if (rating === "shaky") return "Last time: shaky";
  return "Last time: nailed";
}
