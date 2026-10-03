import JSZip from "jszip";
import { guarded } from "@/lib/auth/session";
import { listNotesForExport } from "@/lib/db/notes";
import { createNamer } from "@/lib/export/filename";

/**
 * Every note as a zip of .md files (PRD §4.8).
 *
 * Bodies go out byte-for-byte as stored — no conversion — so what comes out is
 * what Bear, Obsidian or a plain text editor reads back in.
 */
async function handleGET(request: Request) {
  const includeTrashed = new URL(request.url).searchParams.get("trashed") === "true";
  const notes = await listNotesForExport({ includeTrashed });

  const zip = new JSZip();
  const name = createNamer(".md");

  for (const note of notes) {
    zip.file(name(note.title), note.body, { date: note.updatedAt });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const archive = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });

  return new Response(archive as unknown as BodyInit, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="ursa-notes-${stamp}.zip"`,
      "content-length": String(archive.byteLength),
      "cache-control": "no-store",
    },
  });
}

export const GET = guarded(handleGET);
