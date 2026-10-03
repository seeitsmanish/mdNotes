import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { getAttachment } from "@/lib/db/attachments";
import { ATTACHMENT_ID } from "@/lib/attachments/sniff";

type Params = { params: Promise<{ id: string }> };

/**
 * Serve one image to a signed-in session (PRD §4.24). Attachments never
 * change once written, so the browser may cache them for good — privately,
 * since they are behind the password.
 */
async function handleGET(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!ATTACHMENT_ID.test(id)) return NextResponse.json({ error: "No such image." }, { status: 404 });

  const attachment = await getAttachment(id);
  if (!attachment) return NextResponse.json({ error: "No such image." }, { status: 404 });

  return new Response(attachment.bytes as BodyInit, {
    headers: {
      "content-type": attachment.mime,
      "content-length": String(attachment.bytes.byteLength),
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-disposition": "inline",
    },
  });
}

export const GET = guarded(handleGET);
