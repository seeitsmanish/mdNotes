import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { restoreNote } from "@/lib/db/notes";
import { sealUnlessUnlocked } from "@/lib/lock/state";

async function handlePOST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const note = await restoreNote(id);
  if (!note) return NextResponse.json({ error: "No such note." }, { status: 404 });
  return NextResponse.json({ note: await sealUnlessUnlocked(note) });
}

export const POST = guarded(handlePOST);
