import { syntaxTree } from "@codemirror/language";
import { type Extension, StateEffect, StateField } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/**
 * A bare link pasted on its own becomes `[Page title](url)` once the title
 * comes back (PRD §4.63). The URL goes in at once, as pasted; the title
 * arrives a moment later as its own change, so one undo returns the raw URL.
 *
 * The pasted range is tracked through later edits, and the swap only happens
 * if that exact text is still there: typing into the link, deleting it or
 * moving on never gets overwritten.
 */

interface Pending {
  id: number;
  from: number;
  to: number;
  url: string;
}

const add = StateEffect.define<Pending>();
const drop = StateEffect.define<number>();

const pending = StateField.define<Pending[]>({
  create: () => [],
  update(value, tr) {
    let next = tr.docChanged
      ? value
          .map((entry) => ({ ...entry, from: tr.changes.mapPos(entry.from, 1), to: tr.changes.mapPos(entry.to, -1) }))
          .filter((entry) => entry.to - entry.from === entry.url.length)
      : value;
    for (const effect of tr.effects) {
      if (effect.is(add)) next = [...next, effect.value];
      if (effect.is(drop)) next = next.filter((entry) => entry.id !== effect.value);
    }
    return next;
  },
});

const WEB_URL = /^https?:\/\/[^\s<>()[\]]+$/i;
let nextId = 1;

/**
 * Square brackets would end the link text early, and escaped ones show their
 * backslashes in the editor, so they become parentheses.
 */
export function linkLabel(title: string): string {
  return title.replace(/\[/g, "(").replace(/\]/g, ")").replace(/\\/g, "/");
}

function insideCode(view: EditorView, pos: number): boolean {
  for (let node: { name: string; parent: unknown } | null = syntaxTree(view.state).resolveInner(pos, -1); node; ) {
    if (/Code|URL|Link|Image/.test(node.name)) return true;
    node = node.parent as typeof node;
  }
  return false;
}

async function lookUp(url: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/link-title?url=${encodeURIComponent(url)}`);
    if (!response.ok) return null;
    const { title } = (await response.json()) as { title?: unknown };
    return typeof title === "string" && title.trim() ? title.trim() : null;
  } catch {
    return null;
  }
}

const paste = EditorView.domEventHandlers({
  paste(event, view) {
    const url = event.clipboardData?.getData("text/plain")?.trim() ?? "";
    if (!WEB_URL.test(url) || url.length > 2048) return false;
    const { main } = view.state.selection;
    if (!main.empty || view.state.selection.ranges.length > 1) return false;
    if (insideCode(view, main.head)) return false;
    // Already the target of a link being typed: `](` or `<` just before.
    const before = view.state.sliceDoc(Math.max(0, main.head - 2), main.head);
    if (before.endsWith("(") || before.endsWith("<")) return false;

    event.preventDefault();
    const id = nextId++;
    const from = main.head;
    view.dispatch({
      changes: { from, insert: url },
      selection: { anchor: from + url.length },
      effects: add.of({ id, from, to: from + url.length, url }),
      userEvent: "input.paste",
      scrollIntoView: true,
    });

    void lookUp(url).then((title) => {
      const entry = view.state.field(pending, false)?.find((item) => item.id === id);
      if (!entry) return;
      const still = view.state.sliceDoc(entry.from, entry.to) === url;
      if (!title || !still || title === url) {
        view.dispatch({ effects: drop.of(id) });
        return;
      }
      const insert = `[${linkLabel(title)}](${url})`;
      const caretAfter = view.state.selection.main.head === entry.to;
      view.dispatch({
        changes: { from: entry.from, to: entry.to, insert },
        effects: drop.of(id),
        // The caret stays where it was relative to the text; if it sat just
        // after the URL it moves past the finished link.
        ...(caretAfter ? { selection: { anchor: entry.from + insert.length } } : {}),
        userEvent: "input.paste",
      });
    });
    return true;
  },
});

export const linkTitles: Extension = [pending, paste];
