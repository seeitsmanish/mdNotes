import { syntaxTree } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";
import { cellAt, editTable, offsetOfCell, type TableOp } from "@/lib/markdown/tableEdit";

/** The table the caret is in, as a document range, or null (PRD §4.72). */
export function tableAt(view: EditorView): { from: number; to: number } | null {
  const head = view.state.selection.main.head;
  for (let node: { name: string; from: number; to: number; parent: unknown } | null = syntaxTree(view.state).resolveInner(head, -1); node; ) {
    if (node.name === "Table") {
      const doc = view.state.doc;
      return { from: doc.lineAt(node.from).from, to: doc.lineAt(Math.min(node.to, doc.length)).to };
    }
    node = node.parent as typeof node;
  }
  return null;
}

/** Runs a table tool at the caret. False when the caret is not in a table or the tool does not apply. */
export function runTableOp(view: EditorView, op: TableOp): boolean {
  const range = tableAt(view);
  if (!range) return false;
  const source = view.state.sliceDoc(range.from, range.to);
  const at = cellAt(source, view.state.selection.main.head - range.from);
  const result = editTable(source, at, op);
  if (!result) return false;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: result.source },
    selection: { anchor: range.from + offsetOfCell(result.source, result.row, result.col) },
    userEvent: "input.table",
    scrollIntoView: true,
  });
  return true;
}
