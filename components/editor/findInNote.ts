import { foldedRanges, unfoldEffect } from "@codemirror/language";
import { type EditorState, type Extension, StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  keymap,
  type Panel,
  showPanel,
  type ViewUpdate,
} from "@codemirror/view";
import { findPhrase, matchFrom, type Range } from "@/lib/search/matches";

/**
 * Find in note (PRD §4.79): a bar above the note that finds a phrase in it,
 * marks every match, and steps through them with Enter / Shift+Enter or the
 * arrows. Matching ignores case and accents, like search. Opened with ⌘F
 * from the note, or "Find in note" in the note's menu on a phone.
 *
 * The matches follow edits while the bar is open. Closing it leaves the
 * current match selected, so Escape drops you back into the text right there.
 */

interface FindState {
  open: boolean;
  query: string;
  matches: Range[];
  /** Index into `matches`, or -1 when there is none. */
  current: number;
}

const CLOSED: FindState = { open: false, query: "", matches: [], current: -1 };

const setFind = StateEffect.define<{ open: boolean; query: string }>();
const setCurrent = StateEffect.define<number>();

/** Bumped when ⌘F is pressed again, so the open bar re-focuses its input. */
const refocus = StateEffect.define<null>();

const findState = StateField.define<FindState>({
  create: () => CLOSED,
  update(value, tr) {
    let next = value;
    for (const effect of tr.effects) {
      if (effect.is(setFind)) {
        if (!effect.value.open) return CLOSED;
        const matches = findPhrase(tr.state.doc.toString(), effect.value.query);
        next = {
          open: true,
          query: effect.value.query,
          matches,
          current: matchFrom(matches, tr.state.selection.main.from),
        };
      } else if (effect.is(setCurrent)) {
        next = { ...next, current: effect.value };
      }
    }
    if (next.open && tr.docChanged && next === value) {
      // Re-find after an edit, staying on the match nearest the old one.
      const anchor = next.current >= 0 ? tr.changes.mapPos(next.matches[next.current]!.from) : 0;
      const matches = findPhrase(tr.state.doc.toString(), next.query);
      next = { ...next, matches, current: matchFrom(matches, anchor) };
    }
    return next;
  },
  provide: (field) => [
    showPanel.from(field, (state) => (state.open ? createPanel : null)),
    EditorView.decorations.from(field, (state) => {
      if (!state.open || state.matches.length === 0) return Decoration.none;
      return Decoration.set(
        state.matches.map((range, index) =>
          (index === state.current ? CURRENT : HIT).range(range.from, range.to),
        ),
      );
    }),
  ],
});

const HIT = Decoration.mark({ class: "ursa-find-hit" });
const CURRENT = Decoration.mark({ class: "ursa-find-hit ursa-find-current" });

/** Select a match and bring it into view, unfolding a section that hides it. */
function reveal(view: EditorView, index: number): void {
  const state = view.state.field(findState);
  const match = state.matches[index];
  if (!match) {
    view.dispatch({ effects: setCurrent.of(-1) });
    return;
  }
  const unfold: StateEffect<unknown>[] = [];
  foldedRanges(view.state).between(match.from, match.to, (from, to) => {
    unfold.push(unfoldEffect.of({ from, to }));
  });
  view.dispatch({
    effects: [setCurrent.of(index), ...unfold, EditorView.scrollIntoView(match.from, { y: "center" })],
    selection: { anchor: match.from, head: match.to },
  });
}

function step(view: EditorView, by: 1 | -1): boolean {
  const state = view.state.field(findState, false);
  if (!state?.open || state.matches.length === 0) return false;
  const count = state.matches.length;
  const from = state.current < 0 ? (by === 1 ? -1 : 0) : state.current;
  reveal(view, (from + by + count) % count);
  return true;
}

export const findNext = (view: EditorView) => step(view, 1);
export const findPrevious = (view: EditorView) => step(view, -1);

/** What to search for when the bar opens: a short one-line selection, if any. */
function seed(state: EditorState): string | null {
  const { from, to } = state.selection.main;
  if (from === to || to - from > 200) return null;
  const text = state.sliceDoc(from, to);
  return text.includes("\n") ? null : text;
}

export function openFind(view: EditorView): boolean {
  const state = view.state.field(findState, false);
  if (!state) return false;
  const selected = seed(view.state);
  if (state.open) {
    view.dispatch({ effects: [...(selected ? [setFind.of({ open: true, query: selected })] : []), refocus.of(null)] });
  } else {
    view.dispatch({ effects: setFind.of({ open: true, query: selected ?? state.query }) });
  }
  return true;
}

export function closeFind(view: EditorView): boolean {
  const state = view.state.field(findState, false);
  if (!state?.open) return false;
  view.dispatch({ effects: setFind.of({ open: false, query: "" }) });
  view.focus();
  return true;
}

export function isFindOpen(view: EditorView): boolean {
  return view.state.field(findState, false)?.open ?? false;
}

const ICONS = {
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
};

function iconButton(label: string, icon: keyof typeof ICONS, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ursa-find-button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[icon]}</svg>`;
  // Keep focus in the input: a tap on an arrow should not close a phone's keyboard.
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", onClick);
  return button;
}

function countLabel(state: FindState): string {
  if (!state.query.trim()) return "";
  if (state.matches.length === 0) return "No matches";
  const total = state.matches.length;
  return state.current >= 0 ? `${state.current + 1} of ${total}` : `${total} found`;
}

function createPanel(view: EditorView): Panel {
  const dom = document.createElement("div");
  dom.className = "ursa-find";
  dom.setAttribute("role", "search");

  const input = document.createElement("input");
  input.type = "search";
  input.className = "ursa-find-input";
  input.placeholder = "Find in note";
  input.setAttribute("aria-label", "Find in note");
  input.enterKeyHint = "search";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.value = view.state.field(findState).query;

  const count = document.createElement("span");
  count.className = "ursa-find-count";
  count.setAttribute("aria-live", "polite");

  const previous = iconButton("Previous match (⇧⏎)", "up", () => findPrevious(view));
  const next = iconButton("Next match (⏎)", "down", () => findNext(view));
  const close = iconButton("Close (Esc)", "close", () => closeFind(view));

  const render = () => {
    const state = view.state.field(findState);
    count.textContent = countLabel(state);
    dom.classList.toggle("ursa-find-none", state.query.trim().length > 0 && state.matches.length === 0);
    previous.disabled = next.disabled = state.matches.length === 0;
  };

  input.addEventListener("input", () => {
    view.dispatch({ effects: setFind.of({ open: true, query: input.value }) });
    // Land on the first match from the caret as you type, like a browser's find.
    const state = view.state.field(findState);
    if (state.current >= 0) reveal(view, state.current);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) findPrevious(view);
      else findNext(view);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeFind(view);
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
      // Again: select the query to type a new one (and keep the list's search out of it).
      event.preventDefault();
      input.select();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "g") {
      event.preventDefault();
      if (event.shiftKey) findPrevious(view);
      else findNext(view);
    }
  });

  dom.append(input, count, previous, next, close);
  render();

  return {
    dom,
    top: true,
    mount() {
      input.focus();
      input.select();
    },
    update(update: ViewUpdate) {
      const state = update.state.field(findState);
      if (input.value !== state.query && document.activeElement !== input) input.value = state.query;
      for (const tr of update.transactions) {
        for (const effect of tr.effects) {
          if (effect.is(refocus)) {
            input.value = state.query;
            input.focus();
            input.select();
          }
        }
      }
      render();
    },
  };
}

export const findInNote: Extension = [
  findState,
  // ⌘F exactly: CodeMirror's keymap would also answer ⌘⇧F, which belongs
  // to searching all notes.
  EditorView.domEventHandlers({
    keydown(event, view) {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return false;
      if (event.key.toLowerCase() !== "f") return false;
      event.preventDefault();
      return openFind(view);
    },
  }),
  keymap.of([
    { key: "Mod-g", run: findNext, shift: findPrevious },
    { key: "Escape", run: closeFind },
  ]),
];
