"use client";

/**
 * Prepare and upload one image (PRD §4.24).
 *
 * Photos from a phone are 3–8 MB and 4000px wide; nobody reads a note at that
 * size, and the database has a size budget. So images are scaled to at most
 * 2000px on the long side and re-encoded as WebP in the browser before upload.
 * GIFs are sent as they are, because re-encoding would drop the animation.
 */

const MAX_EDGE = 2000;
const QUALITY = 0.82;

export interface Uploaded {
  url: string;
  width: number;
  height: number;
}

async function shrink(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  if (file.type === "image/gif") {
    bitmap.close();
    return { blob: file, width, height };
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot prepare images.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", QUALITY));
  // Safari without WebP encoding returns PNG or null; fall back to the original.
  return { blob: blob && blob.size < file.size ? blob : file, width, height };
}

export async function uploadImage(file: File): Promise<Uploaded> {
  const { blob, width, height } = await shrink(file);
  const form = new FormData();
  form.append("file", blob, file.name || "image");
  form.append("width", String(width));
  form.append("height", String(height));

  const response = await fetch("/api/attachments", { method: "POST", body: form });
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `Upload failed (${response.status}).`);
  }
  const { url } = (await response.json()) as { url: string };
  return { url, width, height };
}

export function isImageFile(file: File): boolean {
  return /^image\/(png|jpe?g|gif|webp|heic|heif|avif|bmp)$/i.test(file.type);
}
