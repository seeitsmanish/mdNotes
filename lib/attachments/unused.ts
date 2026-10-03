import { referencedIds } from "@/lib/export/attachments";

/**
 * Which stored images nothing uses any more (PRD §4.35).
 *
 * An image is in use if any note — trashed ones included — or any kept
 * version of a note refers to it: restoring an old version must not come
 * back with a broken image. Images younger than the grace period are never
 * unused: one being pasted right now is uploaded before its note is saved.
 */

export const UNUSED_GRACE_MS = 60 * 60 * 1000;

export interface StoredImage {
  id: string;
  size: number;
  createdAt: Date;
}

export function findUnused(
  images: StoredImage[],
  bodies: Iterable<string>,
  now: Date,
  graceMs = UNUSED_GRACE_MS,
): StoredImage[] {
  const used = new Set<string>();
  for (const body of bodies) for (const id of referencedIds(body)) used.add(id);
  return images.filter((image) => !used.has(image.id) && now.getTime() - image.createdAt.getTime() >= graceMs);
}
