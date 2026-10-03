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

/** Uploads are resized in the browser first; this is the server's hard cap. */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

/** `/api/attachments/<cuid>` — the only URL shape the app writes into notes. */
export const ATTACHMENT_ID = /^[a-z0-9]{20,40}$/;

export function attachmentUrl(id: string): string {
  return `/api/attachments/${id}`;
}
