import type { Question } from "./questions";

/**
 * What to ask next (PRD §4.23). Weakest first: questions you blanked on, then
 * the shaky ones, then ones never asked, then ones you nailed that are due
 * again. A nailed answer earns a longer rest each time in a row — 1, 2, 4 …
 * days, capped at a month — so practice goes where it is needed.
 *
 * Pure; the memory itself is stored per device by the caller.
 */

export type Rating = "blank" | "shaky" | "nailed";

export interface Memory {
  rating: Rating;
  /** Epoch ms of the last rating. */
  at: number;
  /** Nailed in a row; reset by anything else. */
  streak: number;
}

export type Memories = Record<string, Memory>;

const DAY = 24 * 60 * 60 * 1000;

export function restFor(streak: number): number {
  return Math.min(2 ** Math.max(streak - 1, 0), 30) * DAY;
}

export function tierOf(memory: Memory | undefined, now: number): number {
  if (!memory) return 2;
  if (memory.rating === "blank") return 0;
  if (memory.rating === "shaky") return 1;
  return now - memory.at >= restFor(memory.streak) ? 3 : 4;
}

/** Due = anything but a nailed answer still resting. */
export function isDue(memory: Memory | undefined, now: number): boolean {
  return tierOf(memory, now) < 4;
}

export function order(
  questions: Question[],
  memories: Memories,
  now: number,
  random: () => number = Math.random,
): Question[] {
  // Shuffle first so equal tiers come out in a new order each session — an
  // interview does not ask in the order you wrote things down.
  const shuffled = questions
    .map((q) => ({ q, r: random() }))
    .sort((a, b) => a.r - b.r)
    .map(({ q }) => q);
  return shuffled
    .map((q, i) => ({ q, i, tier: tierOf(memories[q.id], now) }))
    .sort((a, b) => a.tier - b.tier || a.i - b.i)
    .map(({ q }) => q);
}

export function rate(previous: Memory | undefined, rating: Rating, now: number): Memory {
  const streak = rating === "nailed" ? (previous?.rating === "nailed" ? previous.streak + 1 : 1) : 0;
  return { rating, at: now, streak };
}

export interface Tally {
  nailed: number;
  shaky: number;
  blank: number;
  unseen: number;
  due: number;
}

export function tally(questions: Question[], memories: Memories, now: number): Tally {
  const out: Tally = { nailed: 0, shaky: 0, blank: 0, unseen: 0, due: 0 };
  for (const q of questions) {
    const memory = memories[q.id];
    if (!memory) out.unseen += 1;
    else out[memory.rating] += 1;
    if (isDue(memory, now)) out.due += 1;
  }
  return out;
}

/** Parse stored memories defensively: it is per-device data that may be stale or hand-edited. */
export function parseMemories(raw: string | null): Memories {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    const out: Memories = {};
    for (const [id, m] of Object.entries(value as Record<string, unknown>)) {
      const memory = m as Partial<Memory> | null;
      if (
        memory &&
        (memory.rating === "blank" || memory.rating === "shaky" || memory.rating === "nailed") &&
        typeof memory.at === "number" &&
        typeof memory.streak === "number"
      ) {
        out[id] = { rating: memory.rating, at: memory.at, streak: memory.streak };
      }
    }
    return out;
  } catch {
    return {};
  }
}
