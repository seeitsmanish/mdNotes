import { prisma } from "./prisma";
import { applyBody, type Tx } from "./write";
import { deriveTitle } from "@/lib/markdown/derive";
import { MAX_REVISIONS_PER_NOTE, snapshotReason } from "@/lib/history/policy";
import type { NoteDetail } from "@/lib/types";

/** Note history (PRD §4.28). Every query lives here, like every note query. */

/**
 * Lock the note's row and return the body about to be replaced. Locked so a
 * save landing at the same moment cannot slip in between the read and the
 * write — the kept revision is exactly the text that was overwritten.
 */
export async function lockBody(tx: Tx, noteId: string): Promise<string | null> {
  const rows = await tx.$queryRaw<Array<{ body: string }>>`
    SELECT "body" FROM "Note" WHERE "id" = ${noteId} FOR UPDATE`;
  return rows[0]?.body ?? null;
}

/** Keep `previous` if the policy says this save is worth remembering. */
export async function maybeKeepRevision(
  tx: Tx,
  noteId: string,
  previous: string,
  next: string,
  options: { force?: boolean } = {},
): Promise<void> {
  if (previous === next || previous.trim().length === 0) return;
  const now = new Date();
  if (!options.force) {
    const last = await tx.noteRevision.findFirst({
      where: { noteId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (!snapshotReason({ previous, next, lastRevisionAt: last?.createdAt ?? null, now })) return;
  }

  await tx.noteRevision.create({ data: { noteId, body: previous, createdAt: now } });

  // Bounded: the oldest go first once a note has more than the cap.
  const surplus = await tx.noteRevision.findMany({
    where: { noteId },
    orderBy: { createdAt: "desc" },
    skip: MAX_REVISIONS_PER_NOTE,
    select: { id: true },
  });
  if (surplus.length > 0) {
    await tx.noteRevision.deleteMany({ where: { id: { in: surplus.map((r) => r.id) } } });
  }
}

export interface RevisionSummary {
  id: string;
  createdAt: string;
  title: string;
  words: number;
}

export async function listRevisions(noteId: string): Promise<RevisionSummary[]> {
  const rows = await prisma.noteRevision.findMany({
    where: { noteId },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, body: true },
  });
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    title: deriveTitle(row.body),
    words: row.body.trim() ? row.body.trim().split(/\s+/).length : 0,
  }));
}

export async function getRevision(
  noteId: string,
  revisionId: string,
): Promise<{ id: string; createdAt: string; body: string } | null> {
  const row = await prisma.noteRevision.findFirst({
    where: { id: revisionId, noteId },
    select: { id: true, createdAt: true, body: true },
  });
  return row && { id: row.id, createdAt: row.createdAt.toISOString(), body: row.body };
}

/**
 * Put an earlier version back. The current text is kept first, always, so a
 * restore is itself undoable. The write bumps the version, so a save still in
 * flight from before the restore becomes a conflicted copy, not an overwrite.
 */
export async function restoreRevision(
  noteId: string,
  revisionId: string,
  getNote: (id: string) => Promise<NoteDetail | null>,
): Promise<NoteDetail | null> {
  const restored = await prisma.$transaction(async (tx) => {
    const revision = await tx.noteRevision.findFirst({
      where: { id: revisionId, noteId },
      select: { body: true },
    });
    if (!revision) return false;
    const current = await lockBody(tx, noteId);
    if (current === null) return false;
    await maybeKeepRevision(tx, noteId, current, revision.body, { force: true });
    await applyBody(tx, noteId, revision.body);
    return true;
  });
  return restored ? getNote(noteId) : null;
}
