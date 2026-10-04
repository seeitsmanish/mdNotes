/**
 * Title and excerpt are derived from the body, never entered separately
 * (PRD R4.4). Both are denormalised onto the row so the note list can be
 * queried without full bodies — see docs/TECH-SPEC.md §3.
 */

const TITLE_MAX = 120;
const EXCERPT_MAX = 140;

/** A fence line is structure, never prose — it contributes nothing to a row. */
const FENCE = /^\s*(?:```|~~~)/;

/** A table's `|---|:--:|` divider row: structure, like a fence. */
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/;

/** `| a | b |` reads as "a · b" in a list row, not as pipes (PRD R38.2). */
function tableRow(line: string): string {
  // The closing pipe is optional: a stored excerpt may have been cut short.
  if (!/^\s*\|[^|]*\|/.test(line)) return line;
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean)
    .join(" · ");
}

/** Strip markup so a list row shows prose, not punctuation. */
function plain(line: string): string {
  if (FENCE.test(line) || TABLE_DIVIDER.test(line)) return "";
  // A spoiler's point is that it is hidden; the note list must not leak it.
  // Masked first, as its `||` would otherwise read as table cell borders.
  return tableRow(line.replace(/\|\|[^|\n]+\|\|/g, "▒▒▒"))
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\s*>\s?/, "")
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/, "")
    .replace(/^\s*(?:[-*+]|\d{1,9}[.)])\s+/, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/~~([^~]*)~~/g, "$1")
    .replace(/::([^:]*)::/g, "$1")
    .replace(/\*([^*]*)\*/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt: string) => (alt.trim() ? alt : "Image"))
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

export const UNTITLED = "Untitled";

/** First heading if the note opens with one, else the first non-empty line. */
export function deriveTitle(body: string): string {
  for (const line of body.split("\n")) {
    const candidate = plain(line);
    if (candidate.length > 0) return truncate(candidate, TITLE_MAX);
  }
  return "";
}

/** The first prose after the title line, for the note list's second row. */
export function deriveExcerpt(body: string): string {
  const lines = body.split("\n");
  let seenTitle = false;

  for (const line of lines) {
    const candidate = plain(line);
    if (candidate.length === 0) continue;
    if (!seenTitle) {
      seenTitle = true;
      continue;
    }
    return truncate(candidate, EXCERPT_MAX);
  }
  return "";
}

/**
 * Tidies a stored excerpt for display. Excerpts are saved with the note, so
 * rows written before a change to plain() keep their old text until the note
 * is next edited; this applies the same table and image rules on the way out.
 */
export function displayExcerpt(excerpt: string): string {
  return plain(excerpt);
}

export function displayTitle(title: string): string {
  return title.trim().length > 0 ? title : UNTITLED;
}
