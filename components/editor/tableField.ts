import { syntaxTree } from "@codemirror/language";
import { type EditorState, type Range, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import { TableWidget } from "./tableWidget";

/**
 * Rendered tables, as a StateField rather than a ViewPlugin.
 *
 * CodeMirror refuses block decorations from a plugin ("Block decorations may
 * not be specified via plugins") because a plugin's decorations are computed
 * after layout, and replacing line breaks changes layout. Everything else in
 * this editor is a plugin; tables have to be a field.
 */

function buildTables(state: EditorState): DecorationSet {
  const ranges: Range<Decoration>[] = [];

  // Lines holding a cursor or selection edge keep their raw markdown.
  const active = new Set<number>();
  for (const range of state.selection.ranges) {
    const from = state.doc.lineAt(range.from).number;
    const to = state.doc.lineAt(range.to).number;
    for (let line = from; line <= to; line += 1) active.add(line);
  }

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== "Table") return;

      const first = state.doc.lineAt(node.from);
      const last = state.doc.lineAt(Math.min(node.to, state.doc.length));
      for (let line = first.number; line <= last.number; line += 1) {
        if (active.has(line)) return; // being edited — leave the markdown alone
      }

      ranges.push(
        Decoration.replace({
          widget: new TableWidget(state.sliceDoc(first.from, last.to), first.from),
          block: true,
        }).range(first.from, last.to),
      );
    },
  });

  return Decoration.set(ranges, true);
}

export const tableField = StateField.define<DecorationSet>({
  create: buildTables,
  update(value, transaction) {
    // Selection moves in and out of tables constantly, so both a document
    // change and a selection change have to rebuild.
    if (transaction.docChanged || transaction.selection) return buildTables(transaction.state);
    return value.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});
