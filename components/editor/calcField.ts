import { type EditorState, RangeSetBuilder, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { evaluateLines } from "@/lib/calc/calc";

/**
 * Live math (PRD §4.22): the answer to every line ending in `=`, drawn after
 * it. A StateField rather than a viewport plugin, because a name defined at
 * the top of a note is used further down — the whole note has to be read in
 * order, not just the part on screen.
 */

class AnswerWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }

  eq(other: AnswerWidget): boolean {
    return other.text === this.text;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "ursa-calc";
    span.textContent = this.text;
    span.title = "Click to copy";
    span.addEventListener("mousedown", (event) => {
      // Copy the answer instead of moving the caret into the widget.
      event.preventDefault();
      void navigator.clipboard?.writeText(this.text.replace(/,/g, "")).catch(() => undefined);
      span.classList.add("ursa-calc-copied");
      setTimeout(() => span.classList.remove("ursa-calc-copied"), 700);
    });
    return span;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

function build(state: EditorState): DecorationSet {
  const { doc } = state;
  const lines: string[] = [];
  for (let n = 1; n <= doc.lines; n += 1) lines.push(doc.line(n).text);

  const builder = new RangeSetBuilder<Decoration>();
  for (const result of evaluateLines(lines)) {
    const line = doc.line(result.line + 1);
    builder.add(
      line.to,
      line.to,
      Decoration.widget({ widget: new AnswerWidget(result.text), side: 1 }),
    );
  }
  return builder.finish();
}

export const calcField = StateField.define<DecorationSet>({
  create: build,
  update(value, transaction) {
    return transaction.docChanged ? build(transaction.state) : value;
  },
  provide: (field) => EditorView.decorations.from(field),
});
