import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { createAttachment } from "@/lib/db/attachments";
import { attachmentUrl, MAX_ATTACHMENT_BYTES, sniffImage } from "@/lib/attachments/sniff";

/** Upload one image (PRD §4.24). Returns the URL to write into the note. */
async function handlePOST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: "Image is larger than 4 MB." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // The type is read from the bytes; the client's claim is ignored (R24.4).
  const mime = sniffImage(bytes);
  if (!mime) {
    return NextResponse.json(
      { error: "Only PNG, JPEG, GIF and WebP images can be added." },
      { status: 415 },
    );
  }

  const dimension = (name: string) => {
    const value = Number(form.get(name));
    return Number.isInteger(value) && value > 0 && value < 100_000 ? value : undefined;
  };

  const { id } = await createAttachment({
    mime,
    bytes,
    width: dimension("width"),
    height: dimension("height"),
  });
  return NextResponse.json({ id, url: attachmentUrl(id) }, { status: 201 });
}

export const POST = guarded(handlePOST);
