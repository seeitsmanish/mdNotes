import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { listRevisions } from "@/lib/db/history";
import { isNoteLocked } from "@/lib/db/notes";
import { isUnlocked } from "@/lib/lock/state";

type Params = { params: Promise<{ id: string }> };

/** Earlier versions of a note, newest first (PRD §4.28). */
async function handleGET(_request: Request, { params }: Params) {
  const { id } = await params;
  if ((await isNoteLocked(id)) && !(await isUnlocked(id))) {
    return NextResponse.json({ error: "This note is locked. Unlock it first." }, { status: 423 });
  }
  return NextResponse.json({ revisions: await listRevisions(id) });
}

export const GET = guarded(handleGET);
