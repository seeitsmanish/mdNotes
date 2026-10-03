import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { listRevisions } from "@/lib/db/history";

type Params = { params: Promise<{ id: string }> };

/** Earlier versions of a note, newest first (PRD §4.28). */
async function handleGET(_request: Request, { params }: Params) {
  const { id } = await params;
  return NextResponse.json({ revisions: await listRevisions(id) });
}

export const GET = guarded(handleGET);
