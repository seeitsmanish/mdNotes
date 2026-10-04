import { type Range, RangeSet } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

/**
 * Marks the paragraph the caret is in (PRD §4.64), for focus dimming: with
 * the setting on, CSS fades every other line. A paragraph is the run of
 * non-blank lines around the caret, so a list or a code block counts as one
 * thought, as it reads.
 */

const CURRENT = Decoration.line({ class: "ursa-current" });

export function paragraphAround(lines: string[], index: number): [number, number] {
  if (!lines[index]?.trim()) return [index, index];
  let start = index;
  let end = index;
  while (start > 0 && lines[start - 1]?.trim()) start -= 1;
  while (end < lines.length - 1 && lines[end + 1]?.trim()) end += 1;
  return [start, end];
}

function build(view: EditorView): DecorationSet {
  const { doc, selection } = view.state;
  const head = doc.lineAt(selection.main.head).number;
  // Scan outwards line by line rather than splitting the whole document.
  let start = head;
  let end = head;
  if (doc.line(head).text.trim()) {
    while (start > 1 && doc.line(start - 1).text.trim()) start -= 1;
    while (end < doc.lines && doc.line(end + 1).text.trim()) end += 1;
  }
  const ranges: Range<Decoration>[] = [];
  for (let n = start; n <= end; n += 1) ranges.push(CURRENT.range(doc.line(n).from));
  return RangeSet.of(ranges);
}

export const currentParagraph = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet) this.decorations = build(update.view);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
