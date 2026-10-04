import { cookies } from "next/headers";
import { getLockHash } from "@/lib/db/settings";
import type { NoteDetail } from "@/lib/types";
import { UNLOCK_COOKIE, UNLOCK_MINUTES, unlockedScope, unlockToken, validUnlock } from "./passcode";

/**
 * Whether this request may read locked notes (PRD §4.69): a valid, unexpired
 * unlock cookie for the current passcode.
 */
export async function isUnlocked(noteId?: string): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  const [hash, jar] = await Promise.all([getLockHash(), cookies()]);
  return validUnlock(jar.get(UNLOCK_COOKIE)?.value, hash, secret, noteId);
}

/** A locked note as the client may see it while locked: title and labels, never text. */
export function seal(note: NoteDetail): NoteDetail {
  return { ...note, body: "", excerpt: "", cover: null, todoDone: 0, todoTotal: 0, sealed: true };
}

/** Seal the note unless this request is unlocked. Unlocked is checked once, lazily. */
export async function sealUnlessUnlocked(note: NoteDetail): Promise<NoteDetail> {
  if (!note.locked) return note;
  return (await isUnlocked(note.id)) ? note : seal(note);
}

/** Header that keeps a locked note's response out of the offline cache (public/sw.js). */
export const SENSITIVE_HEADER = "x-ursa-sensitive";

/**
 * Restart the unlock window, from a write to a locked note: fifteen minutes
 * of writing must not end with the next save refused. Only called once the
 * request is known to be unlocked.
 */
export async function extendUnlock(): Promise<void> {
  const secret = process.env.AUTH_SECRET;
  const [hash, jar] = await Promise.all([getLockHash(), cookies()]);
  if (!secret || !hash) return;
  const scope = unlockedScope(jar.get(UNLOCK_COOKIE)?.value, hash, secret);
  if (!scope) return;
  jar.set(UNLOCK_COOKIE, unlockToken(hash, secret, scope), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: UNLOCK_MINUTES * 60,
  });
}

