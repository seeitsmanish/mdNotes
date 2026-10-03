import { fold } from "./rank";

/**
 * Accent folding for the SQL that narrows search candidates (PRD R11.4).
 *
 * Search terms are folded in JS (`café` → `cafe`), but the stored text is
 * not, so a plain ILIKE never matched an accented note — `café` found nothing
 * even when typed exactly as written. Postgres' `unaccent` would fix that but
 * is an extension, i.e. a production schema change. Instead the query applies
 * `translate(text, FOLD_FROM, FOLD_TO)`, with the table generated from the
 * same `fold()` the ranking uses, so SQL and ranking cannot disagree about
 * what matches.
 *
 * Covers Latin-1 Supplement and Latin Extended-A/B: every character that
 * folds to a single ASCII letter. Characters that fold to themselves or to
 * several letters (æ, ß) are left alone, exactly as `fold()` leaves them.
 */
function buildTable(): { from: string; to: string } {
  let from = "";
  let to = "";
  for (let code = 0x00c0; code <= 0x024f; code += 1) {
    const ch = String.fromCodePoint(code);
    const folded = fold(ch);
    if (/^[a-z]$/.test(folded) && folded !== ch) {
      from += ch;
      to += folded;
    }
  }
  return { from, to };
}

const TABLE = buildTable();
export const FOLD_FROM = TABLE.from;
export const FOLD_TO = TABLE.to;

/** `%term%` for ILIKE, with the term's own `%`, `_` and `\` matched literally. */
export function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}
