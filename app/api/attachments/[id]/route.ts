import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { getAttachment } from "@/lib/db/attachments";
import { ATTACHMENT_ID } from "@/lib/attachments/sniff";
import { byteRange } from "@/lib/attachments/range";

type Params = { params: Promise<{ id: string }> };

/**
 * Serve one image to a signed-in session (PRD §4.24). Attachments never
 * change once written, so the browser may cache them for good — privately,
 * since they are behind the password.
 */
async function handleGET(request: Request, { params }: Params) {
  const { id } = await params;
  if (!ATTACHMENT_ID.test(id)) return NextResponse.json({ error: "No such image." }, { status: 404 });

  const attachment = await getAttachment(id);
  if (!attachment) return NextResponse.json({ error: "No such image." }, { status: 404 });

  const headers = {
    "content-type": attachment.mime,
    "cache-control": "private, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
    "content-disposition": "inline",
    "accept-ranges": "bytes",
  };
  // Byte ranges, which media players ask for (kept from §4.74).
  const range = byteRange(request.headers.get("range"), attachment.bytes.byteLength);
  if (range) {
    const [start, end] = range;
    return new Response(attachment.bytes.slice(start, end + 1) as BodyInit, {
      status: 206,
      headers: {
        ...headers,
        "content-range": `bytes ${start}-${end}/${attachment.bytes.byteLength}`,
        "content-length": String(end - start + 1),
      },
    });
  }
  return new Response(attachment.bytes as BodyInit, {
    headers: { ...headers, "content-length": String(attachment.bytes.byteLength) },
  });
}

export const GET = guarded(handleGET);
