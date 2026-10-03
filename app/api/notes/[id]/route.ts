import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { deleteNoteForever, getNote, trashNote, updateNote } from "@/lib/db/notes";
import { parseNotePatch } from "@/lib/notes/patch";

type Params = { params: Promise<{ id: string }> };

async function handleGET(_request: Request, { params }: Params) {
  const { id } = await params;
  const note = await getNote(id);
  if (!note) return NextResponse.json({ error: "No such note." }, { status: 404 });
  return NextResponse.json({ note });
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

  const result = await updateNote(id, parsed.patch);
  if (result.status === "missing") {
    return NextResponse.json({ error: "No such note." }, { status: 404 });
  }
  if (result.status === "conflict") {
    // The stale text is already safe in `copy` (PRD R18.3); 409 tells the
    // client its editor holds an out-of-date version of `note`.
    return NextResponse.json(
      { error: "This note was changed elsewhere.", note: result.note, copy: result.copy },
      { status: 409 },
    );
  }
  return NextResponse.json({ note: result.note });
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
