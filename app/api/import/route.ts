import JSZip from "jszip";
import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { createNotesFromBodies } from "@/lib/db/notes";
import { decide, describeSkip, IMPORT_LIMITS, isMarkdownPath } from "@/lib/export/import";
import { parse as parseFrontmatter } from "@/lib/export/frontmatter";
import { readEntryCapped } from "@/lib/export/unzip";

/**
 * Markdown in, notes out (PRD §4.9).
 *
 * Only ever inserts. A merge that guesses which existing note a file
 * corresponds to will eventually guess wrong, and the cost of that is a
 * destroyed note — so import has no update path at all.
 */
async function handlePOST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart upload." }, { status: 400 });
  }

  const uploads = form.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (uploads.length === 0) {
    return NextResponse.json({ error: "No files were uploaded." }, { status: 400 });
  }

  const totalBytes = uploads.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > IMPORT_LIMITS.maxTotalBytes) {
    return NextResponse.json({ error: "Upload is larger than 50 MB." }, { status: 413 });
  }

  const files: Array<{ path: string; body: string; byteLength: number }> = [];
  // Decompressed bytes across every entry. The upload cap above is on the
  // compressed size, which says nothing about what it inflates to.
  let inflated = 0;
  const tooLarge = IMPORT_LIMITS.maxFileBytes + 1;

  for (const upload of uploads) {
    if (upload.name.toLowerCase().endsWith(".zip")) {
      const zip = await JSZip.loadAsync(await upload.arrayBuffer());
      for (const entry of Object.values(zip.files)) {
        if (entry.dir) continue;
        if (files.length >= IMPORT_LIMITS.maxFiles) break;
        // Decompress only what could plausibly be a note, so a zip full of
        // large binaries is not expanded into memory.
        if (!isMarkdownPath(entry.name)) {
          files.push({ path: entry.name, body: "", byteLength: 0 });
          continue;
        }
        const remaining = IMPORT_LIMITS.maxTotalBytes - inflated;
        const body =
          remaining > 0
            ? await readEntryCapped(entry, Math.min(IMPORT_LIMITS.maxFileBytes, remaining))
            : null;
        if (body === null) {
          // Reported as too large rather than silently dropped (R9.4).
          files.push({ path: entry.name, body: "", byteLength: tooLarge });
          continue;
        }
        const byteLength = new TextEncoder().encode(body).byteLength;
        inflated += byteLength;
        files.push({ path: entry.name, body, byteLength });
      }
    } else {
      const body = await upload.text();
      files.push({ path: upload.name, body, byteLength: upload.size });
    }
  }

  const { accepted, skipped } = decide(files);

  const imported = await createNotesFromBodies(
    accepted.map((file) => {
      const { meta, body } = parseFrontmatter(file.body);
      const createdAt = meta.createdAt ? new Date(meta.createdAt) : undefined;
      return {
        body,
        pinned: meta.pinned === true,
        createdAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : undefined,
      };
    }),
  );

  return NextResponse.json({
    imported,
    skipped: skipped.map((entry) => ({ path: entry.path, reason: describeSkip(entry.reason) })),
  });
}

export const POST = guarded(handlePOST);
