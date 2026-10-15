/**
 * VS Code's editor-group shortcuts (PRD §4.81), as a pure map from a key
 * press to a named action, so the bindings are tested apart from the DOM.
 *
 * Some of VS Code's own keys belong to the browser while mdNotes runs in a
 * tab (⌘W, ⌘⇧T, ⌘⌥→…); they still work in the installed app, and each has
 * an alternative that works everywhere (⌥W, ⌥⇧T, ⌃PageDown…).
 */

export type KeyAction =
  | { kind: "splitRight" }
  | { kind: "splitDown" }
  | { kind: "focusList" }
  | { kind: "focusGroup"; n: number }
  | { kind: "tabAt"; n: number }
  | { kind: "nextTab" }
  | { kind: "previousTab" }
  | { kind: "closeTab" }
  | { kind: "reopenTab" }
  | { kind: "moveToNextGroup" }
  | { kind: "moveToPreviousGroup" }
  | { kind: "flipLayout" }
  | { kind: "startChord" };

/**
 * After ⌘K (VS Code's chord prefix), these second keys. Enter counts only as
 * the first key in an empty palette; letters never do.
 */
export type ChordAction =
  | { kind: "splitDown" }
  | { kind: "closeAllInGroup" }
  | { kind: "closeAll" }
  | { kind: "maximize" }
  | { kind: "keepOpen" }
  | { kind: "togglePin" }
  | { kind: "focusSide"; side: "left" | "right" | "up" | "down" };

export interface KeyPress {
  key: string;
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

const digit = (code: string): number | null => {
  const match = /^Digit([0-9])$/.exec(code) ?? /^Numpad([0-9])$/.exec(code);
  return match ? Number(match[1]) : null;
};

/** The workbench action for a key press, or null if it is not one. */
export function keyAction(e: KeyPress, mac: boolean): KeyAction | null {
  const mod = mac ? e.metaKey : e.ctrlKey;
  const n = digit(e.code);

  if (mod && !e.altKey && (e.code === "Backslash" || e.key === "\\" || e.key === "|")) {
    return e.shiftKey ? { kind: "splitDown" } : { kind: "splitRight" };
  }
  if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") return { kind: "startChord" };

  // ⌘0 the note list; ⌘1…⌘9 the editor groups.
  if (mod && !e.altKey && !e.shiftKey && n !== null && !(mac && e.ctrlKey)) {
    return n === 0 ? { kind: "focusList" } : { kind: "focusGroup", n };
  }
  // The n-th tab: ⌃1…⌃9 on a Mac, Alt+1…9 elsewhere (and ⌥ on a Mac too).
  if (n !== null && n > 0 && !e.shiftKey) {
    if (mac && e.ctrlKey && !e.metaKey && !e.altKey) return { kind: "tabAt", n };
    if (e.altKey && !e.metaKey && !e.ctrlKey) return { kind: "tabAt", n };
  }

  // Next / previous tab.
  if (e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "PageDown" || e.key === "PageUp")) {
    return e.key === "PageDown" ? { kind: "nextTab" } : { kind: "previousTab" };
  }
  if (e.ctrlKey && !e.metaKey && !e.altKey && e.key === "Tab") {
    return e.shiftKey ? { kind: "previousTab" } : { kind: "nextTab" };
  }
  if (mac && e.metaKey && e.altKey && !e.ctrlKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
    return e.key === "ArrowRight" ? { kind: "nextTab" } : { kind: "previousTab" };
  }
  if (mac && e.metaKey && e.shiftKey && !e.altKey && (e.code === "BracketRight" || e.code === "BracketLeft")) {
    return e.code === "BracketRight" ? { kind: "nextTab" } : { kind: "previousTab" };
  }

  // Move the tab to the next / previous group: ⌃⌘→ on a Mac, Ctrl+Alt+→ elsewhere.
  const moveMods = mac ? e.ctrlKey && e.metaKey && !e.altKey : e.ctrlKey && e.altKey && !e.metaKey;
  if (moveMods && !e.shiftKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
    return e.key === "ArrowRight" ? { kind: "moveToNextGroup" } : { kind: "moveToPreviousGroup" };
  }

  // Close: ⌘W (the installed app), ⌥W anywhere. Reopen: ⌘⇧T, ⌥⇧T.
  if (e.code === "KeyW" && !e.shiftKey && ((mod && !e.altKey) || (e.altKey && !e.metaKey && !e.ctrlKey))) {
    return { kind: "closeTab" };
  }
  if (e.code === "KeyT" && e.shiftKey && ((mod && !e.altKey) || (e.altKey && !e.metaKey && !e.ctrlKey))) {
    return { kind: "reopenTab" };
  }

  // Flip the layout: ⌥⌘0 on a Mac, Shift+Alt+0 elsewhere.
  if (n === 0 && (mac ? e.metaKey && e.altKey : e.shiftKey && e.altKey && !e.ctrlKey)) return { kind: "flipLayout" };

  return null;
}

/** The second key of a ⌘K chord. */
export function chordAction(e: KeyPress, mac: boolean): ChordAction | null {
  const mod = mac ? e.metaKey : e.ctrlKey;
  if (mod && (e.code === "Backslash" || e.key === "\\")) return { kind: "splitDown" };
  // Only modified keys: ⌘K also opens the palette, and a plain W typed into it
  // must stay a W, not close every tab (VS Code's ⌘K W is left out for that).
  if (e.code === "KeyW" && mod && !e.shiftKey) return { kind: "closeAll" };
  if (e.code === "KeyM" && mod) return { kind: "maximize" };
  if (e.key === "Enter") return e.shiftKey ? { kind: "togglePin" } : { kind: "keepOpen" };
  if (mod) {
    const side = ({ ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" } as const)[
      e.key as "ArrowLeft"
    ];
    if (side) return { kind: "focusSide", side };
  }
  return null;
}

export const isMac = (): boolean =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
