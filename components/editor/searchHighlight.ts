import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import { findMatches } from "@/lib/search/matches";

/**
 * Search hits inside the open note (PRD §4.43): every occurrence of the
 * search's terms is marked, and opening a note from a search puts the caret
 * on the first one, scrolled into view. The marks follow edits and clear with
 * the search.
 */

const setHits = StateEffect.define<{ from: number; to: number }[]>();
const hit = Decoration.mark({ class: "ursa-search-hit" });

export const searchHighlight = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, tr) {
    let next = marks.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setHits)) {
        next = Decoration.set(effect.value.map((r) => hit.range(r.from, r.to)));
      }
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/** Marks the query's hits; with `jump`, selects the first and scrolls to it. */
export function highlightSearch(view: EditorView, query: string, jump: boolean): void {
  const ranges = query.trim() ? findMatches(view.state.doc.toString(), query) : [];
  const first = ranges[0];
  view.dispatch({
    effects: [
      setHits.of(ranges),
      ...(jump && first ? [EditorView.scrollIntoView(first.from, { y: "center" })] : []),
    ],
    ...(jump && first ? { selection: { anchor: first.from, head: first.to } } : {}),
  });
}
