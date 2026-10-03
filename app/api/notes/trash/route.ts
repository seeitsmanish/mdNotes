import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { emptyTrash } from "@/lib/db/notes";

/** Permanently delete every trashed note (PRD R12.1). Never runs on a timer. */
async function handleDELETE() {
  return NextResponse.json({ deleted: await emptyTrash() });
}

export const DELETE = guarded(handleDELETE);
