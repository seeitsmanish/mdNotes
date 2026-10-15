import { fold, terms } from "./rank";

/**
 * Where a search's terms occur in a note, as editor ranges (PRD §4.43).
 *
 * Matching folds accents and case exactly as search does, so whatever found
 * the note also lights up inside it. Folding is done a character at a time and
 * kept to one character each, so a position in the folded text is the same
 * position in the note.
 */
export function foldChars(text: string): string {
  let out = "";
  for (const ch of text) {
    const folded = fold(ch);
    // A UTF-16 pair stays two units; anything folding to more or fewer
    // characters (ß, İ) is kept as it is, lowercased only if that is 1:1.
    if (folded.length === ch.length) out += folded;
    else out += ch.toLowerCase().length === ch.length ? ch.toLowerCase() : ch;
  }
  return out;
}

export interface Range {
  from: number;
  to: number;
}

/** Every occurrence of every term, sorted, overlaps merged; capped for huge notes. */
export function findMatches(body: string, query: string, cap = 500): Range[] {
  const wanted = terms(query);
  if (wanted.length === 0) return [];
  const haystack = foldChars(body);
  const ranges: Range[] = [];
  for (const term of wanted) {
    let from = 0;
    while (ranges.length < cap) {
      const at = haystack.indexOf(term, from);
      if (at === -1) break;
      ranges.push({ from: at, to: at + term.length });
      from = at + term.length;
    }
  }
  ranges.sort((a, b) => a.from - b.from || a.to - b.to);
  const merged: Range[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.from <= last.to) last.to = Math.max(last.to, range.to);
    else merged.push({ ...range });
  }
  return merged;
}

/**
 * Find in note (PRD §4.79): every place the query occurs as typed, one phrase
 * rather than separate words, ignoring case and accents like search does.
 * Non-overlapping, in order, capped for huge notes.
 */
export function findPhrase(body: string, query: string, cap = 1000): Range[] {
  if (query.trim().length === 0) return [];
  const needle = foldChars(query);
  const haystack = foldChars(body);
  const ranges: Range[] = [];
  let from = 0;
  while (ranges.length < cap) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    ranges.push({ from: at, to: at + needle.length });
    from = at + needle.length;
  }
  return ranges;
}

/** The match to land on: the first starting at or after `pos`, wrapping to the first. */
export function matchFrom(ranges: Range[], pos: number): number {
  if (ranges.length === 0) return -1;
  const at = ranges.findIndex((range) => range.from >= pos);
  return at === -1 ? 0 : at;
}
