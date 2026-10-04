/**
 * Colour labels (PRD §4.65). A fixed set rather than any hex: a label is
 * found again by its colour, and seven distinct hues are easier to tell
 * apart, and to filter by, than an open picker.
 */
export const NOTE_COLORS = ["red", "orange", "yellow", "green", "blue", "purple", "gray"] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export const COLOR_HEX: Record<NoteColor, string> = {
  red: "#e5484d",
  orange: "#f08c3a",
  yellow: "#e6b422",
  green: "#3fb26f",
  blue: "#4c8df6",
  purple: "#9b6cf0",
  gray: "#8b8d98",
};

export const COLOR_LABEL: Record<NoteColor, string> = {
  red: "Red",
  orange: "Orange",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  purple: "Purple",
  gray: "Grey",
};

export function isNoteColor(value: unknown): value is NoteColor {
  return typeof value === "string" && (NOTE_COLORS as readonly string[]).includes(value);
}
