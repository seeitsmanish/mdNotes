import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { getRevision, restoreRevision } from "@/lib/db/history";
import { getNote, isNoteLocked } from "@/lib/db/notes";
import { isUnlocked } from "@/lib/lock/state";

/** A locked note's earlier text is as private as its current text (PRD §4.69). */
async function lockedOut(id: string): Promise<Response | null> {
  if ((await isNoteLocked(id)) && !(await isUnlocked(id))) {
    return NextResponse.json({ error: "This note is locked. Unlock it first." }, { status: 423 });
  }
  return null;
}

type Params = { params: Promise<{ id: string; revisionId: string }> };

/** One earlier version's full text (PRD §4.28). */
async function handleGET(_request: Request, { params }: Params) {
  const { id, revisionId } = await params;
  const refused = await lockedOut(id);
  if (refused) return refused;
  const revision = await getRevision(id, revisionId);
  if (!revision) return NextResponse.json({ error: "No such version." }, { status: 404 });
  return NextResponse.json({ revision });
}

/** Restore it. The current text is kept as a version first. */
async function handlePOST(_request: Request, { params }: Params) {
  const { id, revisionId } = await params;
  const refused = await lockedOut(id);
  if (refused) return refused;
  const note = await restoreRevision(id, revisionId, getNote);
  if (!note) return NextResponse.json({ error: "No such version." }, { status: 404 });
  return NextResponse.json({ note });
}

export const GET = guarded(handleGET);
export const POST = guarded(handlePOST);
