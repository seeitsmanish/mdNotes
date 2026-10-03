/**
 * Ranking and snippets for search results (PRD §4.11).
 *
 * Pure: ranking is the part worth testing, and it should not need a database to
 * do it. The server applies this to rows it has already fetched (R11.5).
 */

export interface Searchable {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  updatedAt: Date | string;
}

export interface SearchHit {
  id: string;
  /** Higher is better. */
  score: number;
  /** Text around the first body match, for display. */
  snippet: string;
  /** Ranges within `snippet` to mark, as [start, end) pairs. */
  marks: Array<[number, number]>;
}

const SNIPPET_RADIUS = 60;
const SNIPPET_MAX = 160;

/**
 * Lowercase and strip accents, so `cafe` finds `Café` (R11.4).
 *
 * Offsets into the folded string stay valid against the original: NFD followed
 * by removing combining marks restores the original length for the Latin text
 * this handles, so a snippet can be sliced from the original by folded index.
 */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function terms(query: string): string[] {
  return fold(query)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
}

function findAll(haystack: string, needle: string): number[] {
  const found: number[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return found;
    found.push(at);
    from = at + needle.length;
  }
}

interface Snippet {
  snippet: string;
  marks: Array<[number, number]>;
}

/** Text around the earliest match, with the ranges to mark (R11.2). */
function snippetFor(body: string, foldedBody: string, queryTerms: string[]): Snippet {
  const hits: Array<[number, number]> = [];
  for (const term of queryTerms) {
    for (const at of findAll(foldedBody, term)) hits.push([at, at + term.length]);
  }

  if (hits.length === 0) {
    return { snippet: body.slice(0, SNIPPET_MAX).trim(), marks: [] };
  }

  hits.sort((a, b) => a[0] - b[0]);
  const firstAt = hits[0]![0];

  let start = Math.max(0, firstAt - SNIPPET_RADIUS);
  // Don't cut a word in half at the left edge.
  if (start > 0) {
    const space = body.indexOf(" ", start);
    if (space !== -1 && space < firstAt) start = space + 1;
  }
  const end = Math.min(body.length, start + SNIPPET_MAX);

  const prefix = start > 0 ? "…" : "";
  const suffix = end < body.length ? "…" : "";
  const offset = prefix.length - start;

  return {
    snippet: prefix + body.slice(start, end) + suffix,
    marks: hits
      .filter(([from, to]) => from >= start && to <= end)
      .map(([from, to]) => [from + offset, to + offset] as [number, number]),
  };
}

/**
 * Score one note, or null when it does not contain every term (R11.3).
 *
 * Title matches dominate body matches and an earlier match beats a later one,
 * so "the note actually called this" sorts above "the note that mentions it".
 */
export function score(note: Searchable, queryTerms: string[]): SearchHit | null {
  if (queryTerms.length === 0) return null;

  const foldedTitle = fold(note.title);
  const foldedBody = fold(note.body);

  let total = 0;
  for (const term of queryTerms) {
    const inTitle = foldedTitle.indexOf(term);
    const inBody = foldedBody.indexOf(term);
    if (inTitle === -1 && inBody === -1) return null;

    if (inTitle !== -1) {
      total += 1000;
      if (foldedTitle === term) total += 1000; // the note is called exactly this
      else if (inTitle === 0) total += 500; // title starts with it
      total += Math.max(0, 100 - inTitle);
    }
    if (inBody !== -1) {
      total += 100;
      total += Math.max(0, 50 - Math.floor(inBody / 20));
    }
  }

  if (note.pinned) total += 250;

  return { id: note.id, score: total, ...snippetFor(note.body, foldedBody, queryTerms) };
}

/** Rank matching notes best-first; recency only breaks ties (R11.1). */
export function rank(notes: Searchable[], query: string): SearchHit[] {
  const queryTerms = terms(query);
  if (queryTerms.length === 0) return [];

  const scored: Array<{ hit: SearchHit; updatedAt: number }> = [];
  for (const note of notes) {
    const hit = score(note, queryTerms);
    if (hit) scored.push({ hit, updatedAt: new Date(note.updatedAt).getTime() });
  }

  scored.sort((a, b) => b.hit.score - a.hit.score || b.updatedAt - a.updatedAt);
  return scored.map((entry) => entry.hit);
}
