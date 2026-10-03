/**
 * When a save keeps the text it is about to replace (PRD §4.28).
 *
 * Every save keeping a copy would mean a revision per 400 ms of typing, so a
 * copy is kept at most once per quiet interval — enough to step back through
 * a writing session — plus always before a save that throws most of the note
 * away, which is what a bad paste or a select-all-delete looks like. Those
 * are the moments history exists for, so they never wait for the interval.
 *
 * Pure; the writer applies it inside the save transaction.
 */

export const SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000;
export const MAX_REVISIONS_PER_NOTE = 50;

/** A save that keeps less than this share of a substantial note is a big cut. */
const BIG_CUT_KEEPS = 0.5;
const SUBSTANTIAL_CHARS = 200;

export interface SnapshotInput {
  /** The body about to be replaced. */
  previous: string;
  next: string;
  /** When the newest revision of this note was kept, or null if never. */
  lastRevisionAt: Date | null;
  now: Date;
}

export type SnapshotReason = "interval" | "big-cut" | null;

export function snapshotReason({ previous, next, lastRevisionAt, now }: SnapshotInput): SnapshotReason {
  if (previous === next) return null;
  // An empty note has nothing worth restoring.
  if (previous.trim().length === 0) return null;

  if (previous.length >= SUBSTANTIAL_CHARS && next.length < previous.length * BIG_CUT_KEEPS) {
    return "big-cut";
  }
  if (!lastRevisionAt || now.getTime() - lastRevisionAt.getTime() >= SNAPSHOT_INTERVAL_MS) {
    return "interval";
  }
  return null;
}
