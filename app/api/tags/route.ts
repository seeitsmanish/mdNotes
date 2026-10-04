import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { tagsByNote } from "@/lib/db/notes";
import { tagTree } from "@/lib/markdown/tags";

/** The tag tree, derived from note text (PRD §4.66). */
async function handleGET() {
  return NextResponse.json({ tree: tagTree(await tagsByNote()) });
}

export const GET = guarded(handleGET);
