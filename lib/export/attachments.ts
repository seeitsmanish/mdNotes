/**
 * Images in exports (PRD §4.29).
 *
 * A note refers to an image as `/api/attachments/<id>` — a URL that only
 * means something inside this app. In an export the image travels in the zip
 * as `attachments/<id>.<ext>`, and the note's link is rewritten to that
 * relative path, so the archive opens correctly in Obsidian, VS Code or any
 * markdown viewer. Import does the reverse. This is the one change export
 * makes to a note's text (R8.3); without it an archive could not show its own
 * images, and a restore would lose them.
 */

const APP_URL = /\/api\/attachments\/([a-z0-9]{20,40})/g;
/** `attachments/<id>.<ext>`, optionally written `./attachments/…`. */
const ARCHIVE_PATH = /(?:\.\/)?attachments\/([a-z0-9]{20,40})\.(webp|png|jpe?g|gif|webm|m4a|ogg|mp3)/gi;

export const ARCHIVE_DIR = "attachments";

const EXTENSIONS: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
};

export function extensionFor(mime: string): string {
  return EXTENSIONS[mime] ?? "bin";
}

export function archivePath(id: string, mime: string): string {
  return `${ARCHIVE_DIR}/${id}.${extensionFor(mime)}`;
}

/** Attachment ids a note refers to, each once. */
export function referencedIds(body: string): string[] {
  return [...new Set([...body.matchAll(APP_URL)].map((m) => m[1] ?? ""))].filter(Boolean);
}

/** App URLs → archive paths, for ids present in `mimes`; others are left alone. */
export function toArchive(body: string, mimes: Map<string, string>): string {
  return body.replace(APP_URL, (whole, id: string) => {
    const mime = mimes.get(id);
    return mime ? archivePath(id, mime) : whole;
  });
}

/** Archive paths → app URLs, using the ids the images received on import. */
export function fromArchive(body: string, newIds: Map<string, string>): string {
  return body.replace(ARCHIVE_PATH, (whole, oldId: string) => {
    const id = newIds.get(oldId);
    return id ? `/api/attachments/${id}` : whole;
  });
}

/** The old id an archive entry carries, if the entry is an exported image. */
export function archiveEntryId(path: string): string | null {
  const match = /(?:^|\/)attachments\/([a-z0-9]{20,40})\.(webp|png|jpe?g|gif|webm|m4a|ogg|mp3)$/i.exec(path);
  return match?.[1] ?? null;
}
