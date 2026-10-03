/**
 * Hanging indent for list items (PRD R2.10).
 *
 * A list item that wraps used to continue at the left edge, under its own
 * number, so "14." sat alone in a column of text. The wrapped lines now start
 * under the item's text. The width to hang by is whatever the prefix occupies
 * on screen, which differs by kind:
 *
 * - `14. ` and `- ` are shown as typed, so their text is measured.
 * - `- [ ] ` shows neither the dash nor the brackets: the dash is hidden and
 *   the brackets become a checkbox widget, whose width is fixed in CSS.
 *
 * Pure: the caller measures `text` in the editor's font and adds `extraEm`.
 */

/** `.ursa-checkbox` is 0.95em wide plus a 0.55em right margin. */
export const CHECKBOX_EM = 1.5;

const LIST_PREFIX = /^([ \t]*)([-*+]|\d{1,9}[.)])([ \t]+)(\[[ xX]\][ \t]+)?/;

export interface HangingPrefix {
  /** The prefix characters that are visible, to be measured. */
  text: string;
  /** Width in em contributed by widgets rather than text. */
  extraEm: number;
}

export function hangingPrefix(line: string): HangingPrefix | null {
  const match = LIST_PREFIX.exec(line);
  if (!match) return null;
  const [, indent = "", marker = "", gap = "", task] = match;
  // Nothing follows the marker: there is no text to hang under.
  if (match[0].length >= line.length) return null;

  const lead = indent.replace(/\t/g, "    ");
  if (task) {
    // The dash is hidden, the space after it stays; `[ ]` becomes the
    // checkbox; the space after `]` stays.
    const after = task.slice(3).replace(/\t/g, "    ");
    return { text: `${lead}${gap}${after}`, extraEm: CHECKBOX_EM };
  }
  return { text: `${lead}${marker}${gap.replace(/\t/g, "    ")}`, extraEm: 0 };
}
