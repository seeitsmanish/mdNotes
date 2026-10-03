import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { backlinksFor, getNote } from "@/lib/db/notes";

async function handleGET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const note = await getNote(id);
  if (!note) return NextResponse.json({ error: "No such note." }, { status: 404 });

  return NextResponse.json({ backlinks: await backlinksFor(id, note.title) });
}

export const GET = guarded(handleGET);
