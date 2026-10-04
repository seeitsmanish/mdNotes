/**
 * What an uploaded file really is, from its first bytes (PRD R24.4).
 *
 * The browser's `type` is whatever the client says, so it is never trusted.
 * Only raster formats are accepted. SVG in particular is refused: it is XML
 * that can carry script, and serving it from this origin would be a stored
 * XSS waiting for an import to deliver it.
 */

export type ImageMime = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

export function sniffImage(bytes: Uint8Array): ImageMime | null {
  const at = (i: number) => bytes[i] ?? -1;
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return "image/png";
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";
  if (at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x38) return "image/gif";
  if (
    at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 &&
    at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export type AudioMime = "audio/webm" | "audio/mp4" | "audio/ogg" | "audio/mpeg";

/**
 * Voice memos (PRD §4.74): what browsers record — WebM/Opus (Chrome,
 * Firefox, Android), MP4/AAC (Safari, iPhone) — plus Ogg and MP3. Read from
 * the bytes like images; the browser's claim is never trusted.
 */
export function sniffAudio(bytes: Uint8Array): AudioMime | null {
  const at = (i: number) => bytes[i] ?? -1;
  if (at(0) === 0x1a && at(1) === 0x45 && at(2) === 0xdf && at(3) === 0xa3) return "audio/webm";
  if (at(4) === 0x66 && at(5) === 0x74 && at(6) === 0x79 && at(7) === 0x70) return "audio/mp4"; // "ftyp"
  if (at(0) === 0x4f && at(1) === 0x67 && at(2) === 0x67 && at(3) === 0x53) return "audio/ogg";
  if ((at(0) === 0x49 && at(1) === 0x44 && at(2) === 0x33) || (at(0) === 0xff && (at(1) & 0xe0) === 0xe0)) return "audio/mpeg";
  return null;
}

/** Anything the app stores: an image or a voice memo. */
export function sniffAttachment(bytes: Uint8Array): ImageMime | AudioMime | null {
  return sniffImage(bytes) ?? sniffAudio(bytes);
}

/** Uploads are resized in the browser first; this is the server's hard cap. */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

/** `/api/attachments/<cuid>` — the only URL shape the app writes into notes. */
export const ATTACHMENT_ID = /^[a-z0-9]{20,40}$/;

export function attachmentUrl(id: string): string {
  return `/api/attachments/${id}`;
}
