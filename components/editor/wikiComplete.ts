import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { Facet } from "@codemirror/state";
import { fetchNotes } from "@/lib/api";
import { fold } from "@/lib/search/rank";

/**
 * `[[` suggests note titles (PRD §4.45). A wiki-link only works if its text
 * matches a title, and titles are easy to misremember; picking one writes it
 * exactly and closes the link.
 */

/** The partial title being typed after an unclosed `[[`, or null. */
export function wikiQuery(textBeforeCaret: string): { offset: number; query: string } | null {
  const match = /\[\[([^\][\n]*)$/.exec(textBeforeCaret);
  if (!match) return null;
  return { offset: match.index + 2, query: match[1]! };
}

/** Titles matching a query: prefix matches first, then anywhere; accent- and case-blind. */
export function rankTitles(titles: string[], query: string, limit = 30): string[] {
  const q = fold(query.trim());
  const unique = [...new Set(titles.map((t) => t.trim()).filter(Boolean))];
  if (!q) return unique.slice(0, limit);
  const starts: string[] = [];
  const contains: string[] = [];
  for (const title of unique) {
    const folded = fold(title);
    if (folded.startsWith(q)) starts.push(title);
    else if (folded.includes(q)) contains.push(title);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** The open note's id, so it is not offered as a link to itself. */
export const currentNoteId = Facet.define<string | null, string | null>({
  combine: (values) => values[0] ?? null,
});

export interface TitleEntry {
  id: string;
  title: string;
}

export function wikiSource(
  getNotes: () => Promise<TitleEntry[]>,
  peekNotes: () => TitleEntry[] | null = () => null,
) {
  return (context: CompletionContext): CompletionResult | null | Promise<CompletionResult | null> => {
    const line = context.state.doc.lineAt(context.pos);
    const found = wikiQuery(line.text.slice(0, context.pos - line.from));
    if (!found) return null;

    const build = (notes: TitleEntry[]): CompletionResult | null => {
      const self = context.state.facet(currentNoteId);
      const titles = notes.filter((n) => n.id !== self).map((n) => n.title);
      const from = line.from + found.offset;
      // An auto-inserted or already-typed `]]` is reused, not doubled.
      const closed = context.state.sliceDoc(context.pos, context.pos + 2) === "]]";
      const options: Completion[] = rankTitles(titles, found.query).map((title, index) => ({
        label: title,
        boost: -index,
        apply: (view, _c, start, end) => {
          view.dispatch({
            changes: { from: start, to: end, insert: closed ? title : `${title}]]` },
            selection: { anchor: start + title.length + 2 },
            userEvent: "input.complete",
          });
        },
      }));
      return options.length === 0 ? null : { from, options, filter: false };
    };

    // Answer synchronously once titles are cached: an async answer leaves a
    // moment in which Enter types a newline instead of choosing.
    const ready = peekNotes();
    if (ready) return build(ready);
    return getNotes().then((notes) => (context.aborted ? null : build(notes)));
  };
}

/**
 * Every live note's title, fetched when first needed and kept for 30s, so
 * typing `[[` does not hit the server per keystroke. The note list on screen
 * may be filtered by a search, so this asks for the whole list.
 */
let cached: { at: number; titles: Promise<TitleEntry[]>; value?: TitleEntry[] } | null = null;

/** The cached titles if they are loaded and fresh, without waiting. */
export function peekTitles(): TitleEntry[] | null {
  if (!cached || Date.now() - cached.at > 30_000) {
    void noteTitles();
    return null;
  }
  return cached.value ?? null;
}

export function noteTitles(): Promise<TitleEntry[]> {
  if (!cached || Date.now() - cached.at > 30_000) {
    const titles = fetchNotes({ filter: "all" })
      .then(({ notes }) => {
        const value = notes.map((note) => ({ id: note.id, title: note.title }));
        if (cached?.titles === titles) cached.value = value;
        return value;
      })
      .catch(() => {
        cached = null;
        return [];
      });
    cached = { at: Date.now(), titles };
  }
  return cached.titles;
}
