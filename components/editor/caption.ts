/**
 * Whether an image's alt text is worth showing as a caption (PRD §4.54).
 * Pasted images get their filename or a placeholder as alt text; those are
 * noise under a picture, so only words someone actually wrote are shown.
 */
export function captionOf(alt: string): string | null {
  const text = alt.trim();
  if (!text) return null;
  if (/^(image|img|photo|picture|screenshot)$/i.test(text)) return null;
  if (/\.(png|jpe?g|gif|webp|heic|heif|avif|bmp|tiff?)$/i.test(text)) return null;
  if (/^uploading image/i.test(text)) return null;
  if (/^(IMG|DSC|PXL|Screenshot)[ _-]?\d/i.test(text)) return null;
  return text;
}
