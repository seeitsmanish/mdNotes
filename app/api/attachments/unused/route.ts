import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { countUnused, deleteUnused } from "@/lib/db/attachments";

/**
 * Images no note or kept version uses (PRD §4.35). GET counts them; DELETE
 * removes them, and only ever runs because the owner pressed the button.
 */
async function handleGET() {
  return NextResponse.json(await countUnused());
}

async function handleDELETE() {
  return NextResponse.json(await deleteUnused());
}

export const GET = guarded(handleGET);
export const DELETE = guarded(handleDELETE);
