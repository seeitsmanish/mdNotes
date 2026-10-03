import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";

/**
 * The note's headings (PRD §4.14).
 *
 * Read from the same syntax tree the editor renders from (R14.4), so the
 * outline cannot disagree with the document — a second markdown parse here
 * would eventually drift from the one doing the styling.
 */

export interface OutlineItem {
  level: number;
  text: string;
  from: number;
}

const HEADING = /^ATXHeading([1-6])$/;

export function readOutline(state: EditorState): OutlineItem[] {
  const items: OutlineItem[] = [];

  syntaxTree(state).iterate({
    enter: (node) => {
      const match = HEADING.exec(node.name);
      if (!match) return;

      const line = state.doc.lineAt(node.from);
      // Strip the leading #s and the space after them; everything else is text.
      const text = line.text.replace(/^\s*#{1,6}\s*/, "").trim();
      if (text.length === 0) return;

      items.push({ level: Number(match[1]), text, from: node.from });
    },
  });

  return items;
}

/** The last heading at or before `pos` — the section the caret is in (R14.2). */
export function activeHeading(items: OutlineItem[], pos: number): number | null {
  let active: number | null = null;
  for (const item of items) {
    if (item.from <= pos) active = item.from;
    else break;
  }
  return active;
}
