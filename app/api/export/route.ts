import JSZip from "jszip";
import { guarded } from "@/lib/auth/session";
import { listNotesForExport } from "@/lib/db/notes";
import { createNamer } from "@/lib/export/filename";
import { serialise } from "@/lib/export/frontmatter";
import { getAttachments } from "@/lib/db/attachments";
import { archivePath, referencedIds, toArchive } from "@/lib/export/attachments";

/**
 * Every note as a zip of .md files (PRD §4.8, §4.16).
 *
 * Streamed, because export is the only recovery path this app has and an
 * in-memory archive would fail on exactly the library large enough to be worth
 * saving. Bodies go out byte-for-byte; only frontmatter is added, so what comes
 * out is still what any markdown editor reads back in.
 */
async function handleGET(request: Request) {
  const params = new URL(request.url).searchParams;
  const includeTrashed = params.get("trashed") === "true";
  // Metadata can be turned off for exports headed somewhere that would show it
  // as text.
  const withMeta = params.get("meta") !== "false";

  const notes = await listNotesForExport({ includeTrashed });

  const zip = new JSZip();
  const name = createNamer(".md");

  // Images travel with the notes that show them (PRD §4.29): each referenced
  // attachment once, under attachments/, with links rewritten to match.
  const images = await getAttachments([...new Set(notes.flatMap((n) => referencedIds(n.body)))]);
  const mimes = new Map(images.map((image) => [image.id, image.mime]));
  for (const image of images) {
    zip.file(archivePath(image.id, image.mime), image.bytes, { date: image.createdAt, binary: true });
  }

  for (const note of notes) {
    const body = toArchive(note.body, mimes);
    const content = withMeta
      ? serialise(
          {
            id: note.id,
            createdAt: note.createdAt.toISOString(),
            updatedAt: note.updatedAt.toISOString(),
            pinned: note.pinned,
          },
          body,
        )
      : body;
    zip.file(name(note.title), content, { date: note.updatedAt });
  }

  const stamp = new Date().toISOString().slice(0, 10);

  // generateInternalStream emits chunks as they are deflated, so peak memory is
  // one chunk rather than the whole archive.
  const archive = new ReadableStream<Uint8Array>({
    start(controller) {
      zip
        .generateInternalStream({ type: "uint8array", compression: "DEFLATE" })
        .on("data", (chunk: Uint8Array) => controller.enqueue(chunk))
        .on("error", (error: Error) => controller.error(error))
        .on("end", () => controller.close())
        .resume();
    },
  });

  return new Response(archive, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="ursa-notes-${stamp}.zip"`,
      "cache-control": "no-store",
    },
  });
}

export const GET = guarded(handleGET);
