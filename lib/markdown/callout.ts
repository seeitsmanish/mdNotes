/**
 * Callout boxes (PRD §4.63): a blockquote whose first line opens with a
 * GitHub/Obsidian-style marker, `> [!warning] Optional title`.
 *
 * Pure, so the editor's decorations and the HTML export read callouts the
 * same way.
 */

export type CalloutType = "note" | "tip" | "important" | "warning" | "caution" | "success" | "question";

/** `hue` matches the editor's colours in globals.css, for the HTML export. */
export const CALLOUTS: Record<CalloutType, { label: string; icon: string; hue: string }> = {
  note: { label: "Note", icon: "i", hue: "#4f8ff7" },
  tip: { label: "Tip", icon: "✦", hue: "#2fb37a" },
  important: { label: "Important", icon: "!", hue: "#9d6cf2" },
  warning: { label: "Warning", icon: "!", hue: "#d9921e" },
  caution: { label: "Caution", icon: "×", hue: "#e5534b" },
  success: { label: "Done", icon: "✓", hue: "#34a853" },
  question: { label: "Question", icon: "?", hue: "#22a6b3" },
};

/** Other spellings people bring from Obsidian, mapped onto the seven above. */
const ALIASES: Record<string, CalloutType> = {
  info: "note",
  abstract: "note",
  summary: "note",
  hint: "tip",
  danger: "caution",
  error: "caution",
  bug: "caution",
  check: "success",
  done: "success",
  faq: "question",
  help: "question",
  attention: "warning",
};

export interface Callout {
  type: CalloutType;
  /** The title after the marker, or the type's own label when there is none. */
  title: string;
  /** Whether `title` was written by the user. */
  custom: boolean;
  /** Offsets of `[!type]` and the spaces after it, within the line. */
  markerFrom: number;
  markerTo: number;
}

const MARKER = /^(\s*>\s?)(\[!([a-z]+)\][+-]?[ \t]*)(.*)$/i;

export function calloutType(word: string): CalloutType | null {
  const key = word.toLowerCase();
  if (key in CALLOUTS) return key as CalloutType;
  return ALIASES[key] ?? null;
}

/** Reads a callout from a blockquote's first line, or null if it is a plain quote. */
export function parseCallout(line: string): Callout | null {
  const match = MARKER.exec(line);
  if (!match) return null;
  const [, lead = "", marker = "", word = "", rest = ""] = match;
  const type = calloutType(word);
  if (!type) return null;
  const title = rest.trim();
  const markerFrom = lead.length;
  return {
    type,
    title: title || CALLOUTS[type].label,
    custom: title.length > 0,
    markerFrom,
    markerTo: markerFrom + marker.length,
  };
}
