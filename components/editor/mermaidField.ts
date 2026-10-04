import { syntaxTree } from "@codemirror/language";
import { type EditorState, type Range, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";

/**
 * Diagrams from text (PRD §4.64): a ```mermaid block draws as a diagram
 * while the caret is outside it, and shows its source when clicked into,
 * like tables. Mermaid is large, so it loads the first time a note has a
 * diagram, never for notes without one.
 *
 * A StateField, because block widgets cannot come from a view plugin.
 */

type Mermaid = (typeof import("mermaid"))["default"];
let loading: Promise<Mermaid> | null = null;
const rendered = new Map<string, { svg: string } | { error: string }>();
let counter = 0;

function load(): Promise<Mermaid> {
  loading ??= import("mermaid").then((module) => module.default);
  return loading;
}

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

async function render(code: string): Promise<{ svg: string } | { error: string }> {
  const theme = isDark() ? "dark" : "default";
  const key = `${theme}\n${code}`;
  const cached = rendered.get(key);
  if (cached) return cached;
  const mermaid = await load();
  // Strict: no click handlers or raw HTML labels from note text.
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme, fontFamily: "inherit" });
  let result: { svg: string } | { error: string };
  try {
    const { svg } = await mermaid.render(`ursa-mermaid-${(counter += 1)}`, code);
    result = { svg };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result = { error: message.split("\n").slice(0, 3).join(" ").slice(0, 240) };
  }
  rendered.set(key, result);
  return result;
}

class MermaidWidget extends WidgetType {
  constructor(
    readonly code: string,
    readonly from: number,
  ) {
    super();
  }

  eq(other: MermaidWidget): boolean {
    return other.code === this.code && other.from === this.from;
  }

  get estimatedHeight(): number {
    return 180;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "ursa-mermaid";
    wrapper.setAttribute("role", "img");
    wrapper.setAttribute("aria-label", "Diagram. Click to edit its source.");
    wrapper.textContent = "Drawing diagram…";

    void render(this.code).then((result) => {
      if ("svg" in result) {
        // Mermaid's own output, sanitised by it in strict mode.
        wrapper.innerHTML = result.svg;
      } else {
        wrapper.textContent = "";
        const note = document.createElement("span");
        note.className = "ursa-mermaid-error";
        note.textContent = `This diagram has a mistake: ${result.error}`;
        wrapper.append(note);
      }
      view.requestMeasure();
    });

    wrapper.addEventListener("mousedown", (event) => {
      event.preventDefault();
      view.dispatch({ selection: { anchor: this.from }, scrollIntoView: true });
      view.focus();
    });
    return wrapper;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function build(state: EditorState): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const active = new Set<number>();
  for (const range of state.selection.ranges) {
    const from = state.doc.lineAt(range.from).number;
    const to = state.doc.lineAt(range.to).number;
    for (let line = from; line <= to; line += 1) active.add(line);
  }

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== "FencedCode") return;
      const info = node.node.getChild("CodeInfo");
      if (!info || state.sliceDoc(info.from, info.to).trim().toLowerCase() !== "mermaid") return false;
      const first = state.doc.lineAt(node.from);
      const last = state.doc.lineAt(Math.min(node.to, state.doc.length));
      // Unclosed fence: still being typed.
      if (last.number === first.number || !/^\s*(```|~~~)\s*$/.test(last.text)) return false;
      for (let line = first.number; line <= last.number; line += 1) if (active.has(line)) return false;
      const code = state.sliceDoc(state.doc.line(first.number + 1).from, last.from).trimEnd();
      if (!code.trim()) return false;
      ranges.push(
        Decoration.replace({ widget: new MermaidWidget(code, first.from), block: true }).range(first.from, last.to),
      );
      return false;
    },
  });
  return Decoration.set(ranges, true);
}

export const mermaidField = StateField.define<DecorationSet>({
  create: build,
  update(value, transaction) {
    if (transaction.docChanged || transaction.selection) return build(transaction.state);
    return value.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});
