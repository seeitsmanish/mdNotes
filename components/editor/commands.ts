import { type ChangeSpec, EditorSelection } from "@codemirror/state";
import { type Command, EditorView, type KeyBinding } from "@codemirror/view";
import { indentLess, indentMore } from "@codemirror/commands";
import { syntaxTree } from "@codemirror/language";

/**
 * Editing commands, shared by the keymap and the floating format bar.
 *
 * Each one works on a selection or, with no selection, inserts the delimiters
 * and leaves the caret between them.
 */

function wrap(delim: string): Command {
  return (view) => {
    const changes = view.state.changeByRange((range) => {
      const selected = view.state.sliceDoc(range.from, range.to);

      // Toggle off when the selection is already wrapped.
      if (
        selected.length >= delim.length * 2 &&
        selected.startsWith(delim) &&
        selected.endsWith(delim)
      ) {
        const inner = selected.slice(delim.length, selected.length - delim.length);
        return {
          changes: { from: range.from, to: range.to, insert: inner },
          range: EditorSelection.range(range.from, range.from + inner.length),
        };
      }

      // Also toggle off when the delimiters sit just outside the selection —
      // which is where wrapping leaves it, so a second press undoes the first.
      // A longer run is a different marker (`*` inside `**bold**`), not ours.
      const before = view.state.sliceDoc(range.from - delim.length, range.from);
      const after = view.state.sliceDoc(range.to, range.to + delim.length);
      const beyond = view.state.sliceDoc(range.from - delim.length - 1, range.from - delim.length);
      const past = view.state.sliceDoc(range.to + delim.length, range.to + delim.length + 1);
      if (
        !range.empty &&
        before === delim &&
        after === delim &&
        beyond !== delim[0] &&
        past !== delim[0]
      ) {
        return {
          changes: [
            { from: range.from - delim.length, to: range.from },
            { from: range.to, to: range.to + delim.length },
          ],
          range: EditorSelection.range(range.from - delim.length, range.to - delim.length),
        };
      }

      const insert = `${delim}${selected}${delim}`;
      return {
        changes: { from: range.from, to: range.to, insert },
        range: range.empty
          ? EditorSelection.cursor(range.from + delim.length)
          : EditorSelection.range(
              range.from + delim.length,
              range.from + delim.length + selected.length,
            ),
      };
    });

    view.dispatch(changes, { scrollIntoView: true, userEvent: "input.format" });
    return true;
  };
}

export const toggleBold = wrap("**");
export const toggleItalic = wrap("*");
export const toggleHighlight = wrap("::");
export const toggleSpoiler = wrap("||");
export const toggleInlineCode = wrap("`");
export const toggleStrike = wrap("~~");

export const insertLink: Command = (view) => {
  const changes = view.state.changeByRange((range) => {
    const label = view.state.sliceDoc(range.from, range.to);
    const insert = `[${label}](url)`;
    // Drop the caret on `url` so the next keystroke replaces it.
    const urlFrom = range.from + label.length + 3;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.range(urlFrom, urlFrom + 3),
    };
  });

  view.dispatch(changes, { scrollIntoView: true, userEvent: "input.format" });
  return true;
};

/** Apply a line-leading pattern across every selected line. */
function eachLine(
  view: EditorView,
  edit: (text: string, lineFrom: number) => ChangeSpec | null,
): boolean {
  const { state } = view;
  const changes: ChangeSpec[] = [];
  const touched = new Set<number>();

  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;

    for (let number = first; number <= last; number += 1) {
      if (touched.has(number)) continue;
      touched.add(number);

      const line = state.doc.line(number);
      if (line.text.trim().length === 0) continue;

      const change = edit(line.text, line.from);
      if (change) changes.push(change);
    }
  }

  if (changes.length === 0) return false;
  view.dispatch({ changes, userEvent: "input.format" });
  return true;
}

const LEADING = /^(\s*)((?:[-*+]|\d{1,9}[.)])\s+(?:\[[ xX]\]\s+)?|>\s?|#{1,6}\s+)?/;

/** Replace whatever line-leading markup a line has with `marker`, or strip it. */
function setLeading(marker: string | ((indent: string) => string)): Command {
  return (view) =>
    eachLine(view, (text, lineFrom) => {
      const match = LEADING.exec(text);
      const indent = match?.[1] ?? "";
      const existing = match?.[2] ?? "";
      const next = typeof marker === "function" ? marker(indent) : marker;

      // Pressing the same control twice clears the markup.
      const insert = existing === next ? indent : indent + next;
      return { from: lineFrom, to: lineFrom + indent.length + existing.length, insert };
    });
}

export const toggleBullet = setLeading("- ");
export const toggleQuote = setLeading("> ");

export function setHeading(level: number): Command {
  return setLeading(`${"#".repeat(level)} `);
}

/** Cycle plain line → todo → done → plain, across every selected line. */
export const toggleTodo: Command = (view) =>
  eachLine(view, (text, lineFrom) => {
    const done = /^(\s*)([-*+])(\s+)\[[xX]\](\s+)/.exec(text);
    if (done) {
      return { from: lineFrom, to: lineFrom + done[0].length, insert: done[1] ?? "" };
    }

    const open = /^(\s*)([-*+])(\s+)\[ \](\s+)/.exec(text);
    if (open) {
      const markFrom = lineFrom + open[1]!.length + open[2]!.length + open[3]!.length;
      return { from: markFrom, to: markFrom + 3, insert: "[x]" };
    }

    const match = LEADING.exec(text);
    const indent = match?.[1] ?? "";
    const existing = match?.[2] ?? "";
    return { from: lineFrom, to: lineFrom + indent.length + existing.length, insert: `${indent}- [ ] ` };
  });

export const insertTable: Command = (view) => {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const prefix = line.text.trim().length === 0 ? "" : "\n\n";
  const table = "| Column | Column |\n| --- | --- |\n|  |  |";

  view.dispatch({
    changes: { from: line.to, insert: prefix + table },
    selection: { anchor: line.to + prefix.length + table.length - 4 },
    scrollIntoView: true,
    userEvent: "input.format",
  });
  return true;
};

export const insertCodeBlock: Command = (view) => {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const prefix = line.text.trim().length === 0 ? "" : "\n\n";
  const block = "```\n\n```";

  view.dispatch({
    changes: { from: line.to, insert: prefix + block },
    // Caret on the fence's language slot, which is usually the next thing typed.
    selection: { anchor: line.to + prefix.length + 3 },
    scrollIntoView: true,
    userEvent: "input.format",
  });
  return true;
};

const URL_ONLY = /^(https?:\/\/|mailto:)\S+$/;

/**
 * Pasting a URL over selected text makes a link out of it, rather than
 * replacing the words you meant to keep.
 */
export const smartPaste = EditorView.domEventHandlers({
  paste(event, view) {
    const pasted = event.clipboardData?.getData("text/plain")?.trim();
    if (!pasted || !URL_ONLY.test(pasted)) return false;
    if (view.state.selection.ranges.every((range) => range.empty)) return false;

    const changes = view.state.changeByRange((range) => {
      if (range.empty) return { range };
      const label = view.state.sliceDoc(range.from, range.to);
      const insert = `[${label}](${pasted})`;
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.cursor(range.from + insert.length),
      };
    });

    event.preventDefault();
    view.dispatch(changes, { userEvent: "input.paste" });
    return true;
  },
});

const LIST_LINE = /^\s*(?:[-*+]|\d+[.)])\s/;

function inCodeBlock(view: EditorView, pos: number): boolean {
  for (let node: { name: string; parent: unknown } | null = syntaxTree(view.state).resolveInner(pos, -1); node; ) {
    if (node.name === "FencedCode" || node.name === "CodeBlock") return true;
    node = node.parent as typeof node;
  }
  return false;
}

/**
 * Tab types a tab, rather than leaving the editor for the next button (PRD
 * R61.5). On a list line it nests the item instead, and across several lines
 * it indents them all — what Tab means in every notes app. Inside a code
 * block it is always a literal tab. Ctrl-M (Shift-Alt-M on a Mac) switches
 * Tab back to moving focus, for keyboard users leaving the editor.
 */
export const insertTabOrIndent: Command = (view) => {
  const { state } = view;
  const ranges = state.selection.ranges;
  const multiline = ranges.some((r) => state.doc.lineAt(r.from).number !== state.doc.lineAt(r.to).number);
  if (multiline) return indentMore(view);
  const head = state.selection.main.head;
  if (!inCodeBlock(view, head) && LIST_LINE.test(state.doc.lineAt(head).text)) return indentMore(view);
  view.dispatch(state.replaceSelection("\t"), { scrollIntoView: true, userEvent: "input" });
  return true;
};

export const ursaKeymap: KeyBinding[] = [
  { key: "Tab", run: insertTabOrIndent, shift: indentLess, preventDefault: true },
  { key: "Mod-b", run: toggleBold, preventDefault: true },
  { key: "Mod-i", run: toggleItalic, preventDefault: true },
  { key: "Mod-Shift-h", run: toggleHighlight, preventDefault: true },
  { key: "Mod-Shift-e", run: toggleSpoiler, preventDefault: true },
  { key: "Mod-Shift-c", run: toggleInlineCode, preventDefault: true },
  { key: "Mod-Shift-x", run: toggleStrike, preventDefault: true },
  // ⌘K belongs to the command palette; the editor must not also claim it.
  { key: "Mod-Shift-k", run: insertLink, preventDefault: true },
  { key: "Mod-Shift-7", run: toggleTodo, preventDefault: true },
  { key: "Mod-Shift-8", run: toggleBullet, preventDefault: true },
];
