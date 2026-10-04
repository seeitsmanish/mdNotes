import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { SHARE_TOKEN } from "@/lib/notes/shareToken";

/**
 * Public read-only links (PRD §4.68). One link per note; the token is 128
 * random bits (22 base64url characters), so links cannot be guessed or
 * enumerated. Revoking deletes the row and the link is dead at once.
 */

export { SHARE_TOKEN };

export async function getShareToken(noteId: string): Promise<string | null> {
  const row = await prisma.noteShare.findUnique({ where: { noteId }, select: { token: true } });
  return row?.token ?? null;
}

/** The note's link, made if it has none. Null when the note cannot be shared (missing, trashed, locked). */
export async function createShare(noteId: string): Promise<string | null> {
  const note = await prisma.note.findUnique({ where: { id: noteId }, select: { deletedAt: true, locked: true } });
  if (!note || note.deletedAt || note.locked) return null;
  const existing = await getShareToken(noteId);
  if (existing) return existing;
  const token = randomBytes(16).toString("base64url");
  await prisma.noteShare.create({ data: { token, noteId } });
  return token;
}

export async function revokeShare(noteId: string): Promise<void> {
  await prisma.noteShare.deleteMany({ where: { noteId } });
}

/** What a visitor may read for a token: nothing once trashed or locked. */
export async function sharedNote(token: string): Promise<{ title: string; body: string; updatedAt: Date } | null> {
  if (!SHARE_TOKEN.test(token)) return null;
  const row = await prisma.noteShare.findUnique({
    where: { token },
    select: { note: { select: { title: true, body: true, updatedAt: true, deletedAt: true, locked: true } } },
  });
  const note = row?.note;
  if (!note || note.deletedAt || note.locked) return null;
  return { title: note.title, body: note.body, updatedAt: note.updatedAt };
}
