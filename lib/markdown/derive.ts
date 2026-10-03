/**
 * Title and excerpt are derived from the body, never entered separately
 * (PRD R4.4). Both are denormalised onto the row so the note list can be
 * queried without full bodies — see docs/TECH-SPEC.md §3.
 */

const TITLE_MAX = 120;
const EXCERPT_MAX = 140;

/** A fence line is structure, never prose — it contributes nothing to a row. */
const FENCE = /^\s*(?:```|~~~)/;

/** Strip markup so a list row shows prose, not punctuation. */
function plain(line: string): string {
  if (FENCE.test(line)) return "";
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\s*>\s?/, "")
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/, "")
    .replace(/^\s*(?:[-*+]|\d{1,9}[.)])\s+/, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/~~([^~]*)~~/g, "$1")
    .replace(/::([^:]*)::/g, "$1")
    .replace(/\*([^*]*)\*/g, "$1")
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

export function displayTitle(title: string): string {
  return title.trim().length > 0 ? title : UNTITLED;
}
