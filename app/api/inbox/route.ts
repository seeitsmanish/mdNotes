import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { appendToInbox } from "@/lib/db/notes";
import { inboxEntry, MAX_CAPTURE } from "@/lib/notes/inbox";

/** Quick capture: add a thought to the Inbox note (PRD §4.73). */
async function handlePOST(request: Request) {
  let payload: { text?: unknown; stamp?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Nothing to capture." }, { status: 400 });
  if (text.length > MAX_CAPTURE) return NextResponse.json({ error: "That's too long for a quick note — make it a note of its own." }, { status: 413 });
  const stamp = typeof payload.stamp === "string" ? payload.stamp : "";

  const result = await appendToInbox(inboxEntry(text, stamp));
  if (result === "locked") return NextResponse.json({ error: "Your Inbox note is locked. Unlock it, or rename it." }, { status: 423 });
  return NextResponse.json({ id: result.id }, { status: 201 });
}

export const POST = guarded(handlePOST);
