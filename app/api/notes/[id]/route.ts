import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { deleteNoteForever, getNote, isNoteLocked, trashNote, updateNote } from "@/lib/db/notes";
import { getLockHash } from "@/lib/db/settings";
import { extendUnlock, isUnlocked, seal, SENSITIVE_HEADER } from "@/lib/lock/state";
import type { NoteDetail } from "@/lib/types";

/** Locked notes go out sealed unless unlocked, and never into the offline cache (PRD §4.69). */
function respond(body: Record<string, unknown>, notes: NoteDetail[], init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  if (notes.some((note) => note.locked)) response.headers.set(SENSITIVE_HEADER, "1");
  return response;
}
import { parseNotePatch } from "@/lib/notes/patch";

type Params = { params: Promise<{ id: string }> };

async function handleGET(_request: Request, { params }: Params) {
  const { id } = await params;
  const note = await getNote(id);
  if (!note) return NextResponse.json({ error: "No such note." }, { status: 404 });
  const shown = note.locked && !(await isUnlocked()) ? seal(note) : note;
  return respond({ note: shown }, [note]);
}

async function handlePATCH(request: Request, { params }: Params) {
  const { id } = await params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const parsed = parseNotePatch(payload);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // Writing a locked note's text, or taking its lock off, needs it unlocked;
  // locking needs a passcode to exist. Labels like pin need neither.
  const unlocked = await isUnlocked();
  const wasLocked = await isNoteLocked(id);
  if (wasLocked && !unlocked && (parsed.patch.body !== undefined || parsed.patch.locked === false)) {
    return NextResponse.json({ error: "This note is locked. Unlock it first." }, { status: 423 });
  }
  if (parsed.patch.locked === true && !(await getLockHash())) {
    return NextResponse.json({ error: "Set a passcode before locking notes." }, { status: 409 });
  }

  if (wasLocked && unlocked && parsed.patch.body !== undefined) await extendUnlock();

  const result = await updateNote(id, parsed.patch);
  if (result.status === "missing") {
    return NextResponse.json({ error: "No such note." }, { status: 404 });
  }
  if (result.status === "conflict") {
    // The stale text is already safe in `copy` (PRD R18.3); 409 tells the
    // client its editor holds an out-of-date version of `note`.
    const show = (note: NoteDetail) => (note.locked && !unlocked ? seal(note) : note);
    return respond(
      { error: "This note was changed elsewhere.", note: show(result.note), copy: show(result.copy) },
      [result.note, result.copy],
      { status: 409 },
    );
  }
  // Locking just now from an unlocked browser keeps it readable here.
  const shown = result.note.locked && !unlocked ? seal(result.note) : result.note;
  return respond({ note: shown }, [result.note]);
}

async function handleDELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const permanent = new URL(request.url).searchParams.get("permanent") === "true";

  if (permanent) await deleteNoteForever(id);
  else await trashNote(id);

  return new NextResponse(null, { status: 204 });
}

export const GET = guarded(handleGET);

export const PATCH = guarded(handlePATCH);

export const DELETE = guarded(handleDELETE);
