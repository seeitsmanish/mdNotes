import { EditorState, type TransactionSpec } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { ensureSyntaxTree, foldedRanges } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { headingFold, toggleSection } from "./headingFold";

function setup(doc: string) {
  let state = EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage }), headingFold] });
  ensureSyntaxTree(state, doc.length, 5000);
  const view = {
    get state() {
      return state;
    },
    dispatch(spec: TransactionSpec) {
      state = state.update(spec).state;
    },
  } as unknown as EditorView;
  const folds = () => {
    const out: string[] = [];
    foldedRanges(state).between(0, state.doc.length, (from, to) => {
      out.push(state.sliceDoc(from, to));
    });
    return out;
  };
  return { view, folds, line: (n: number) => state.doc.line(n).from };
}

describe("toggleSection", () => {
  const doc = "# Google\nround one\nround two\n## Onsite\ndesign\n# Meta\nheap";

  it("folds a heading's section, up to the next heading of its level", () => {
    const { view, folds, line } = setup(doc);
    expect(toggleSection(view, line(1))).toBe(true);
    expect(folds()).toEqual(["\nround one\nround two\n## Onsite\ndesign"]);
  });

  it("a second toggle unfolds it", () => {
    const { view, folds, line } = setup(doc);
    toggleSection(view, line(1));
    toggleSection(view, line(1));
    expect(folds()).toEqual([]);
  });

  it("folds a subsection on its own", () => {
    const { view, folds, line } = setup(doc);
    toggleSection(view, line(4));
    expect(folds()).toEqual(["\ndesign"]);
  });

  it("does nothing on a line that is not a heading with a section", () => {
    const { view, line } = setup("# Empty\n# Next");
    expect(toggleSection(view, line(1))).toBe(false);
  });
});
