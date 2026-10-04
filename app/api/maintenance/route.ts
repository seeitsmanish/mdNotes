import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { runMaintenance } from "@/lib/db/backups";

/**
 * Called by the app on launch (PRD §4.77): makes the weekly backup if it is
 * due and deletes old trash if that is on. Idempotent and cheap otherwise,
 * so no scheduler is needed.
 */
async function handlePOST() {
  return NextResponse.json(await runMaintenance());
}

export const POST = guarded(handlePOST);
