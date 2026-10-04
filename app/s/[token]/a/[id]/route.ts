import { NextResponse } from "next/server";
import { getAttachment } from "@/lib/db/attachments";
import { sharedNote } from "@/lib/db/shares";
import { ATTACHMENT_ID } from "@/lib/attachments/sniff";

type Params = { params: Promise<{ token: string; id: string }> };

/**
 * An image in a shared note (PRD §4.68). Public, but only for an image that
 * note's text actually uses: a share link opens one note, not the library.
 */
export async function GET(_request: Request, { params }: Params) {
  const { token, id } = await params;
  const missing = () => NextResponse.json({ error: "No such image." }, { status: 404, headers: { "cache-control": "no-store" } });
  if (!ATTACHMENT_ID.test(id)) return missing();
  const note = await sharedNote(token);
  if (!note || !note.body.includes(`/api/attachments/${id}`)) return missing();
  const attachment = await getAttachment(id);
  if (!attachment) return missing();
  return new Response(attachment.bytes as BodyInit, {
    headers: {
      "content-type": attachment.mime,
      "content-length": String(attachment.bytes.byteLength),
      // Not immutable: revoking the link must stop the image too.
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "content-disposition": "inline",
    },
  });
}
