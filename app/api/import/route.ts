import JSZip from "jszip";
import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth/session";
import { createNotesFromBodies } from "@/lib/db/notes";
import { decide, describeSkip, IMPORT_LIMITS, isMarkdownPath } from "@/lib/export/import";
import { parse as parseFrontmatter } from "@/lib/export/frontmatter";
import { readEntryBytesCapped, readEntryCapped } from "@/lib/export/unzip";
import { archiveEntryId, fromArchive } from "@/lib/export/attachments";
import { createAttachment } from "@/lib/db/attachments";
import { attachmentUrl, MAX_ATTACHMENT_BYTES, sniffAttachment } from "@/lib/attachments/sniff";
import { enexToNote, parseEnex } from "@/lib/import/enex";
import { keepToNote, type KeepNote, parseKeep } from "@/lib/import/keep";
import { IMAGE_FILE, relativeImages, rewriteImages } from "@/lib/import/relative";

/**
 * Notes in (PRD §4.9, §4.75): markdown files or zips of them — this app's own
 * exports, Notion's, Obsidian vaults — plus Google Keep (Takeout JSON) and
 * Evernote (.enex). Images come along: this app's archive folder, files a
 * markdown note links by relative path, Keep attachments, Evernote resources.
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
  const remaining = () => IMPORT_LIMITS.maxTotalBytes - inflated;
  const tooLarge = IMPORT_LIMITS.maxFileBytes + 1;
  /** Exported images, old id → the id each gets here (PRD §4.29). */
  const newImageIds = new Map<string, string>();
  const imageSkips: Array<{ path: string; reason: string }> = [];
  /** Image files in the zip by path, read only if a note refers to them. */
  const zipImages = new Map<string, JSZip.JSZipObject>();
  const keepNotes: Array<{ path: string; note: KeepNote }> = [];

  let storedCount = 0;
  /** One image or recording stored as an attachment, through the upload checks. */
  const store = async (bytes: Uint8Array | null, path: string): Promise<string | null> => {
    const mime = bytes ? sniffAttachment(bytes) : null;
    if (!bytes || !mime) {
      imageSkips.push({ path, reason: bytes ? "not a supported image" : "image too large" });
      return null;
    }
    inflated += bytes.byteLength;
    const { id } = await createAttachment({ mime, bytes });
    storedCount += 1;
    return id;
  };
  const readCapped = (entry: JSZip.JSZipObject, max: number) =>
    remaining() > 0 ? readEntryBytesCapped(entry, Math.min(max, remaining())) : Promise.resolve(null);

  const enexNotes: Array<ReturnType<typeof parseEnex>[number]> = [];

  for (const upload of uploads) {
    const lower = upload.name.toLowerCase();
    if (lower.endsWith(".enex")) {
      enexNotes.push(...parseEnex(await upload.text()));
      continue;
    }
    if (lower.endsWith(".json")) {
      const note = parseKeep(await upload.text());
      if (note) keepNotes.push({ path: upload.name, note });
      else imageSkips.push({ path: upload.name, reason: "not a Google Keep note" });
      continue;
    }
    if (!lower.endsWith(".zip")) {
      const body = await upload.text();
      files.push({ path: upload.name, body, byteLength: upload.size });
      continue;
    }

    const zip = await JSZip.loadAsync(await upload.arrayBuffer());
    for (const entry of Object.values(zip.files)) {
      if (entry.dir) continue;
      if (files.length + keepNotes.length >= IMPORT_LIMITS.maxFiles) break;
      const name = entry.name;
      const entryLower = name.toLowerCase();

      // An image exported with its notes: stored again, through the same
      // checks as an upload — magic bytes decide the type, SVG never passes.
      const oldId = archiveEntryId(name);
      if (oldId) {
        const id = await store(await readCapped(entry, MAX_ATTACHMENT_BYTES), name);
        if (id) newImageIds.set(oldId, id);
        continue;
      }
      // Any other image: kept aside in case a note links it (Notion, Obsidian, Keep).
      if (IMAGE_FILE.test(entryLower)) {
        zipImages.set(name, entry);
        continue;
      }
      // Google Keep's Takeout: one JSON per note.
      if (entryLower.endsWith(".json")) {
        const text = await readEntryCapped(entry, Math.min(IMPORT_LIMITS.maxFileBytes, Math.max(0, remaining())));
        const note = text ? parseKeep(text) : null;
        if (text) inflated += text.length;
        if (note) keepNotes.push({ path: name, note });
        continue;
      }
      if (entryLower.endsWith(".enex")) {
        const text = await readEntryCapped(entry, Math.max(0, remaining()));
        if (text) {
          inflated += text.length;
          enexNotes.push(...parseEnex(text));
        }
        continue;
      }

      // Decompress only what could plausibly be a note, so a zip full of
      // large binaries is not expanded into memory.
      if (!isMarkdownPath(name)) {
        files.push({ path: name, body: "", byteLength: 0 });
        continue;
      }
      const bytes = remaining() > 0 ? await readEntryCapped(entry, Math.min(IMPORT_LIMITS.maxFileBytes, remaining())) : null;
      if (bytes === null) {
        // Reported as too large rather than silently dropped (R9.4).
        files.push({ path: name, body: "", byteLength: tooLarge });
        continue;
      }
      const byteLength = new TextEncoder().encode(bytes).byteLength;
      inflated += byteLength;
      files.push({ path: name, body: bytes, byteLength });
    }
  }

  /** A zip image by path, stored once however many notes link it. */
  const linked = new Map<string, string | null>();
  const urlFor = async (path: string): Promise<string | null> => {
    if (!linked.has(path)) {
      const entry = zipImages.get(path);
      const id = entry ? await store(await readCapped(entry, MAX_ATTACHMENT_BYTES), path) : null;
      linked.set(path, id ? attachmentUrl(id) : null);
    }
    return linked.get(path) ?? null;
  };

  const { accepted, skipped } = decide(files);
  const notes: Array<{ body: string; createdAt?: Date; pinned?: boolean; archived?: boolean }> = [];

  for (const file of accepted) {
    const { meta, body } = parseFrontmatter(file.body);
    const createdAt = meta.createdAt ? new Date(meta.createdAt) : undefined;
    // Links to images that came with this archive point at their new home;
    // relative links into the zip (Notion, Obsidian) are brought in too.
    let text = newImageIds.size > 0 ? fromArchive(body, newImageIds) : body;
    const refs = relativeImages(file.path, text);
    if (refs.length > 0) {
      const urls = new Map<string, string>();
      for (const ref of refs) {
        const url = await urlFor(ref.path);
        if (url) urls.set(ref.path, url);
      }
      text = rewriteImages(file.path, text, urls);
    }
    notes.push({
      body: text,
      pinned: meta.pinned === true,
      createdAt: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : undefined,
    });
  }

  for (const { path, note } of keepNotes) {
    const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";
    const urls = new Map<string, string>();
    for (const attachment of note.attachments ?? []) {
      if (!attachment.filePath) continue;
      const url = await urlFor(dir + attachment.filePath);
      if (url) urls.set(attachment.filePath, url);
    }
    const imported = keepToNote(note, (filePath) => urls.get(filePath) ?? null);
    if (imported) notes.push(imported);
  }

  for (const note of enexNotes) {
    const urls = new Map<string, string>();
    for (const resource of note.resources) {
      if (!/^(image|audio)\//.test(resource.mime) || resource.bytes.byteLength > MAX_ATTACHMENT_BYTES) continue;
      const id = await store(resource.bytes, `${note.title || "note"} (attachment)`);
      if (id) urls.set(resource.hash, attachmentUrl(id));
    }
    const imported = enexToNote(note, (hash) => urls.get(hash) ?? null);
    if (imported) notes.push(imported);
  }

  const imported = await createNotesFromBodies(notes);

  return NextResponse.json({
    imported,
    images: storedCount,
    sources: { keep: keepNotes.length, evernote: enexNotes.length, markdown: accepted.length },
    skipped: [
      ...skipped
        // Images and Keep's HTML twins are expected in these exports, not failures.
        .filter((entry) => !(entry.reason === "not-markdown" && /\.(html?|json|enex)$/i.test(entry.path)))
        .map((entry) => ({ path: entry.path, reason: describeSkip(entry.reason) })),
      ...imageSkips,
    ],
  });
}

export const POST = guarded(handlePOST);
