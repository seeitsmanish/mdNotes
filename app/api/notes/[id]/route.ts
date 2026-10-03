import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { deleteNoteForever, getNote, trashNote, updateNote } from "@/lib/db/notes";

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

  const patch = payload as { body?: unknown; pinned?: unknown };
  if (patch.body !== undefined && typeof patch.body !== "string") {
    return NextResponse.json({ error: "`body` must be a string." }, { status: 400 });
  }
  if (patch.pinned !== undefined && typeof patch.pinned !== "boolean") {
    return NextResponse.json({ error: "`pinned` must be a boolean." }, { status: 400 });
  }

  const note = await updateNote(id, {
    body: patch.body as string | undefined,
    pinned: patch.pinned as boolean | undefined,
  });
  if (!note) return NextResponse.json({ error: "No such note." }, { status: 404 });
  return NextResponse.json({ note });
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
