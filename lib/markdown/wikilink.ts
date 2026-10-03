/**
 * `[[Note title]]` links (PRD §4.10).
 *
 * Resolution is by title, normalised — nobody retypes a title exactly, so
 * matching is case- and whitespace-insensitive (R10.2).
 */

const WIKI_LINK = /\[\[([^\]\n]+)\]\]/g;

/** The key two titles must share to be considered the same note. */
export function normaliseTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Every wiki-link target in a body, in first-seen order.
 *
 * Code spans and fenced blocks are stripped first so `[[x]]` inside them stays
 * literal, matching how the editor renders it (R10.4).
 */
export function extractWikiLinks(body: string): string[] {
  const withoutCode = body
    .replace(/```[\s\S]*?(?:```|$)/g, "")
    .replace(/~~~[\s\S]*?(?:~~~|$)/g, "")
    .replace(/`[^`\n]*`/g, "");

  const seen = new Map<string, string>();
  for (const match of withoutCode.matchAll(WIKI_LINK)) {
    const raw = match[1]!.trim();
    if (raw.length === 0) continue;
    const key = normaliseTitle(raw);
    if (!seen.has(key)) seen.set(key, raw);
  }
  return [...seen.values()];
}

/** Does `body` link to `title`? Used to confirm a backlink candidate. */
export function linksTo(body: string, title: string): boolean {
  const target = normaliseTitle(title);
  if (target.length === 0) return false;
  return extractWikiLinks(body).some((link) => normaliseTitle(link) === target);
}
