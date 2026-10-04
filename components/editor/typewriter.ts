import type { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

/**
 * Typewriter scrolling (PRD §4.71): while typing or moving the caret, the
 * caret's line stays in the middle of the screen. Extra space below the text
 * lets the last line reach the middle too.
 */
const centre = ViewPlugin.fromClass(
  class {
    pending = 0;
    update(update: ViewUpdate) {
      if (!update.view.hasFocus) return;
      const typed = update.transactions.some((tr) => tr.isUserEvent("input") || tr.isUserEvent("delete") || tr.isUserEvent("select"));
      if (!typed) return;
      cancelAnimationFrame(this.pending);
      const view = update.view;
      // Not inside the update: dispatching there is not allowed.
      this.pending = requestAnimationFrame(() => {
        view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: "center" }) });
      });
    }
    destroy() {
      cancelAnimationFrame(this.pending);
    }
  },
);

export function typewriter(on: boolean): Extension {
  return on ? [centre, EditorView.contentAttributes.of({ "data-ursa-typewriter": "" })] : [];
}
