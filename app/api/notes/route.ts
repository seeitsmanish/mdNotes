import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { countNotes, createNote, listNotes } from "@/lib/db/notes";
import type { NoteFilter } from "@/lib/types";

const FILTERS: NoteFilter[] = ["all", "pinned", "trash"];

function asFilter(value: string | null): NoteFilter {
  return FILTERS.includes(value as NoteFilter) ? (value as NoteFilter) : "all";
}

async function handleGET(request: Request) {
  const params = new URL(request.url).searchParams;

  // Counts ride along with the list so the filter control does not need its
  // own round trip on every change.
  const [notes, counts] = await Promise.all([
    listNotes({ filter: asFilter(params.get("filter")), query: params.get("q") }),
    countNotes(),
  ]);

  return NextResponse.json({ notes, counts });
}

async function handlePOST() {
  const note = await createNote();
  return NextResponse.json({ note }, { status: 201 });
}

export const GET = guarded(handleGET);

export const POST = guarded(handlePOST);
