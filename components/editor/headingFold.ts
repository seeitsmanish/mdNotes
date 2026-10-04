import {
  codeFolding,
  foldable,
  foldEffect,
  foldedRanges,
  syntaxTree,
  unfoldEffect,
} from "@codemirror/language";
import type { EditorState, Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";

/**
 * Collapse a section under its heading (PRD §4.44). Lezer's markdown already
 * knows a heading's section; this adds the control — a small chevron at the
 * end of the heading, so it can never shift the heading's alignment — and a
 * "…" in place of the folded text, which expands it again when tapped.
 */

const HEADING = /^ATXHeading[1-6]$/;

/** The section a heading line folds, if it has one. */
function sectionAt(state: EditorState, lineFrom: number): { from: number; to: number } | null {
  const line = state.doc.lineAt(lineFrom);
  return foldable(state, line.from, line.to);
}

function foldedAt(state: EditorState, from: number): { from: number; to: number } | null {
  let found: { from: number; to: number } | null = null;
  foldedRanges(state).between(from, from, (a, b) => {
    if (a === from) found = { from: a, to: b };
  });
  return found;
}

export function toggleSection(view: EditorView, lineFrom: number): boolean {
  const section = sectionAt(view.state, lineFrom);
  if (!section) return false;
  const folded = foldedAt(view.state, section.from);
  view.dispatch({ effects: folded ? unfoldEffect.of(folded) : foldEffect.of(section) });
  return true;
}

class FoldToggle extends WidgetType {
  constructor(
    readonly folded: boolean,
    readonly lineFrom: number,
  ) {
    super();
  }

  eq(other: FoldToggle): boolean {
    return other.folded === this.folded && other.lineFrom === this.lineFrom;
  }

  toDOM(view: EditorView): HTMLElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ursa-fold-toggle";
    if (this.folded) button.dataset.folded = "";
    button.setAttribute("aria-label", this.folded ? "Expand section" : "Collapse section");
    button.setAttribute("aria-expanded", String(!this.folded));
    button.title = this.folded ? "Expand section" : "Collapse section";
    // Keep the caret where it is; a fold is not an edit.
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", (event) => {
      event.preventDefault();
      toggleSection(view, this.lineFrom);
    });
    return button;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

function build(view: EditorView): DecorationSet {
  const widgets: Range<Decoration>[] = [];
  const seen = new Set<number>();
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (!HEADING.test(node.name)) return;
        const line = view.state.doc.lineAt(node.from);
        if (seen.has(line.from)) return false;
        seen.add(line.from);
        const section = sectionAt(view.state, line.from);
        if (!section) return false;
        const folded = foldedAt(view.state, section.from) !== null;
        // side -1: before the fold's own replacement, which starts at line end.
        widgets.push(
          Decoration.widget({ widget: new FoldToggle(folded, line.from), side: -1 }).range(line.to),
        );
        return false;
      },
    });
  }
  return Decoration.set(widgets, true);
}

const toggles = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view);
    }
    update(update: ViewUpdate) {
      const foldsChanged = update.transactions.some((tr) =>
        tr.effects.some((e) => e.is(foldEffect) || e.is(unfoldEffect)),
      );
      if (
        update.docChanged ||
        update.viewportChanged ||
        foldsChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = build(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

export const headingFold = [
  codeFolding({
    placeholderDOM(view, onclick) {
      const span = document.createElement("span");
      span.className = "ursa-fold-placeholder";
      span.textContent = "…";
      span.title = "Expand section";
      span.setAttribute("aria-label", "Folded section — expand");
      span.onclick = onclick;
      return span;
    },
  }),
  toggles,
];
