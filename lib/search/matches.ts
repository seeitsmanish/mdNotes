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
