import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { getSettings, saveSettings } from "@/lib/db/settings";
import { sanitise } from "@/lib/settings/schema";

async function handleGET() {
  return NextResponse.json({ settings: await getSettings() });
}

async function handlePATCH(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const patch = sanitise(payload);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid settings in body." }, { status: 400 });
  }

  return NextResponse.json({ settings: await saveSettings(patch) });
}

export const GET = guarded(handleGET);

export const PATCH = guarded(handlePATCH);
