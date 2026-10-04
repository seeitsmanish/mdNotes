import { EditorSelection, EditorState, type TransactionSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { toggleBold, toggleItalic, toggleSpoiler } from "./commands";

/** Runs a command against a bare state; the commands only use state and dispatch. */
function run(command: (view: EditorView) => boolean, doc: string, from: number, to: number) {
  let state = EditorState.create({ doc, selection: EditorSelection.range(from, to) });
  const view = {
    get state() {
      return state;
    },
    dispatch(spec: TransactionSpec) {
      state = state.update(spec).state;
    },
  } as unknown as EditorView;
  command(view);
  const range = state.selection.main;
  return { doc: state.doc.toString(), selected: state.sliceDoc(range.from, range.to), view };
}

describe("wrap commands", () => {
  it("wraps a selection and keeps the text selected", () => {
    expect(run(toggleSpoiler, "end line", 4, 8)).toMatchObject({ doc: "end ||line||", selected: "line" });
  });

  it("a second press undoes the first", () => {
    const once = run(toggleSpoiler, "end line", 4, 8);
    const range = once.view.state.selection.main;
    toggleSpoiler(once.view);
    expect(once.view.state.doc.toString()).toBe("end line");
    expect(range.from).toBe(6);
  });

  it("unwraps a selection that includes its delimiters", () => {
    expect(run(toggleBold, "a **b** c", 2, 7)).toMatchObject({ doc: "a b c", selected: "b" });
  });

  it("italic does not eat half of a bold marker", () => {
    expect(run(toggleItalic, "a **b** c", 4, 5).doc).toBe("a ***b*** c");
  });

  it("an empty selection inserts a pair with the caret inside", () => {
    expect(run(toggleSpoiler, "ab", 1, 1).doc).toBe("a||||b");
  });
});
