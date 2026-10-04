import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { fetchPageTitle, fetchableUrl } from "@/lib/links/pageTitle";

/** The title of a pasted link's page, so it can become `[Title](url)` (PRD §4.63). */
async function handleGET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url") ?? "";
  if (raw.length > 2048 || !fetchableUrl(raw)) {
    return NextResponse.json({ error: "Not a link that can be looked up." }, { status: 400 });
  }
  return NextResponse.json({ title: await fetchPageTitle(raw) });
}

export const GET = guarded(handleGET);
