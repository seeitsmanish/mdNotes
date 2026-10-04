/**
 * Images a markdown file refers to by a relative path inside the same zip —
 * how Notion and Obsidian export them (PRD §4.75). Pure path logic.
 */

const IMAGE = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
export const IMAGE_FILE = /\.(png|jpe?g|gif|webp)$/i;

/** `dir/` + `../img/a%20b.png` → `img/a b.png`; null for absolute or remote references. */
export function resolveRelative(fromFile: string, ref: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith("/") || ref.startsWith("#")) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(ref);
  } catch {
    decoded = ref;
  }
  const parts = fromFile.split("/").slice(0, -1);
  for (const part of decoded.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) return null;
      parts.pop();
    } else parts.push(part);
  }
  return parts.join("/");
}

/** Relative image references in a body, each with the zip path it points at. */
export function relativeImages(fromFile: string, body: string): Array<{ ref: string; path: string }> {
  const found: Array<{ ref: string; path: string }> = [];
  for (const match of body.matchAll(IMAGE)) {
    const ref = match[2] ?? "";
    const path = resolveRelative(fromFile, ref);
    if (path && IMAGE_FILE.test(path)) found.push({ ref, path });
  }
  return found;
}

/** Points each resolved reference at its new URL; others stay as written. */
export function rewriteImages(fromFile: string, body: string, urls: Map<string, string>): string {
  return body.replace(IMAGE, (whole, alt: string, ref: string) => {
    const path = resolveRelative(fromFile, ref);
    const url = path ? urls.get(path) : undefined;
    return url ? `![${alt}](${url})` : whole;
  });
}

/** Notion appends a 32-hex id to every file name; it is noise in a title. */
export function stripNotionId(text: string): string {
  return text.replace(/\s+[0-9a-f]{32}(?=\.\w+$|$)/i, "");
}
