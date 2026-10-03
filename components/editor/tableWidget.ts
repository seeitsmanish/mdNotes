import { EditorView, WidgetType } from "@codemirror/view";
import { type Alignment, parseTable } from "@/lib/markdown/table";

/**
 * Renders a GFM table as an actual table when the caret is elsewhere, and gets
 * out of the way the moment you click into it.
 *
 * This is the same bargain as hiding `**` on an inactive line: you read a
 * table, you edit markdown. The alternative — a grid editor — would mean the
 * document is no longer the source of truth.
 */

/**
 * A deliberately small inline renderer for cell contents.
 *
 * It builds DOM nodes rather than assigning innerHTML: cell text comes from the
 * note, and a markdown table is exactly the kind of place someone pastes
 * content from elsewhere.
 */
function renderInline(text: string, into: HTMLElement): void {
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(~~[^~]+~~)|(\[[^\]]+\]\([^)\s]+\))/g;
  let cursor = 0;

  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > cursor) into.append(text.slice(cursor, at));

    const token = match[0];
    if (token.startsWith("`")) {
      const code = document.createElement("code");
      code.className = "ursa-code";
      code.textContent = token.slice(1, -1);
      into.append(code);
    } else if (token.startsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = token.slice(2, -2);
      into.append(strong);
    } else if (token.startsWith("~~")) {
      const del = document.createElement("span");
      del.className = "ursa-strike";
      del.textContent = token.slice(2, -2);
      into.append(del);
    } else if (token.startsWith("[")) {
      const label = token.slice(1, token.indexOf("]"));
      const anchor = document.createElement("span");
      anchor.className = "ursa-link";
      anchor.textContent = label;
      into.append(anchor);
    } else {
      const em = document.createElement("em");
      em.textContent = token.slice(1, -1);
      into.append(em);
    }

    cursor = at + token.length;
  }

  if (cursor < text.length) into.append(text.slice(cursor));
}

function alignStyle(align: Alignment): string {
  return align ?? "left";
}

export class TableWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly from: number,
  ) {
    super();
  }

  eq(other: TableWidget): boolean {
    return other.source === this.source && other.from === this.from;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "ursa-table-wrap";

    const parsed = parseTable(this.source);
    if (!parsed) {
      // Not a table after all — show the text rather than a mangled grid.
      wrapper.textContent = this.source;
      return wrapper;
    }

    const table = document.createElement("table");
    table.className = "ursa-rendered-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    parsed.headers.forEach((cell, index) => {
      const th = document.createElement("th");
      th.style.textAlign = alignStyle(parsed.align[index] ?? null);
      renderInline(cell, th);
      headRow.append(th);
    });
    thead.append(headRow);
    table.append(thead);

    const tbody = document.createElement("tbody");
    for (const row of parsed.rows) {
      const tr = document.createElement("tr");
      row.forEach((cell, index) => {
        const td = document.createElement("td");
        td.style.textAlign = alignStyle(parsed.align[index] ?? null);
        renderInline(cell, td);
        tr.append(td);
      });
      tbody.append(tr);
    }
    table.append(tbody);
    wrapper.append(table);

    // Clicking the rendered table puts the caret in the markdown behind it, so
    // editing is one click away rather than hidden behind a mode.
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
