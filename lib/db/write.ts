/**
 * The single writer for note bodies, so title and excerpt can never drift from
 * the text they are derived from.
 */

import { deriveExcerpt, deriveTitle } from "@/lib/markdown/derive";
import type { Prisma } from "@/lib/generated/prisma/client";

export type Tx = Prisma.TransactionClient;

export async function applyBody(tx: Tx, noteId: string, body: string): Promise<void> {
  await tx.note.update({
    where: { id: noteId },
    data: { body, title: deriveTitle(body), excerpt: deriveExcerpt(body) },
  });
}
