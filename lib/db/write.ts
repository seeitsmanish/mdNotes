/**
 * The single writer for note bodies, so title, excerpt and cover can never
 * drift from the text they are derived from.
 */

import { deriveCover, deriveExcerpt, deriveTitle } from "@/lib/markdown/derive";
import type { Prisma } from "@/lib/generated/prisma/client";

export type Tx = Prisma.TransactionClient;

function derived(body: string) {
  return { body, title: deriveTitle(body), excerpt: deriveExcerpt(body), cover: deriveCover(body) };
}

/**
 * Write `body` and bump the note's version (PRD R18.1).
 *
 * With `expectedVersion`, the write happens only if the note is still at that
 * version. The check and the write are one conditional UPDATE, so two saves
 * from the same version cannot both succeed (R18.2). Returns false when the
 * check fails — the caller decides what to do with the text, and must not
 * drop it.
 */
export async function applyBody(
  tx: Tx,
  noteId: string,
  body: string,
  expectedVersion?: number,
): Promise<boolean> {
  const result = await tx.note.updateMany({
    where: { id: noteId, ...(expectedVersion === undefined ? {} : { version: expectedVersion }) },
    data: { ...derived(body), version: { increment: 1 } },
  });
  return result.count > 0;
}

/** Insert a new note with `body`, deriving title and excerpt like any write. */
export async function insertBody(tx: Tx, body: string): Promise<{ id: string }> {
  return tx.note.create({ data: derived(body), select: { id: true } });
}
