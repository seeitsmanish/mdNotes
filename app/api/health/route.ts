import { NextResponse } from "next/server";
import { databaseAnswers } from "@/lib/db/health";

/**
 * For uptime checks (PRD §4.32). Public, and says nothing about notes: only
 * whether the app and its database answer, and which release is running.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const db = await databaseAnswers();
  return NextResponse.json(
    { ok: db, db, version: process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown" },
    { status: db ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
