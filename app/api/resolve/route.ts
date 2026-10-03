import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { resolveTitles } from "@/lib/db/notes";

/** Which `[[titles]]` in the open note exist, so unresolved ones look different. */
async function handlePOST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const titles = (payload as { titles?: unknown }).titles;
  if (!Array.isArray(titles) || titles.some((t) => typeof t !== "string")) {
    return NextResponse.json({ error: "`titles` must be an array of strings." }, { status: 400 });
  }

  return NextResponse.json({ resolved: await resolveTitles(titles.slice(0, 500) as string[]) });
}

export const POST = guarded(handlePOST);
