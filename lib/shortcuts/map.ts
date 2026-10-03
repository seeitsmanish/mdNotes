/**
 * The one definition of every shortcut (PRD R13.3).
 *
 * The help dialog renders this, so a shortcut cannot be renamed in one place
 * and left stale in the other. The keymap still owns *behaviour*; this owns the
 * naming, which is the part that drifts.
 */

export interface Shortcut {
  keys: string;
  label: string;
}

export interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Notes",
    shortcuts: [
      { keys: "⌘N", label: "New note" },
      { keys: "⌘P", label: "Pin or unpin" },
      { keys: "⌘⌫", label: "Move to trash" },
    ],
  },
  {
    title: "Getting around",
    shortcuts: [
      { keys: "⌘K", label: "Command palette" },
      { keys: "⌘F", label: "Search notes" },
      { keys: "⌘1", label: "Focus the note list" },
      { keys: "⌘2", label: "Focus the editor" },
      { keys: "↑ ↓", label: "Move through the list" },
      { keys: "⌘.", label: "Focus mode" },
      { keys: "⌘⇧O", label: "Show or hide the outline" },
      { keys: "⌘/", label: "This dialog" },
    ],
  },
  {
    title: "Writing",
    shortcuts: [
      { keys: "⌘B", label: "Bold" },
      { keys: "⌘I", label: "Italic" },
      { keys: "⌘K", label: "Link" },
      { keys: "⌘⇧H", label: "Highlight" },
      { keys: "⌘⇧C", label: "Inline code" },
      { keys: "⌘⇧X", label: "Strikethrough" },
      { keys: "⌘⇧7", label: "To-do" },
      { keys: "⌘⇧8", label: "Bulleted list" },
      { keys: "⏎", label: "Continue a list or quote" },
    ],
  },
  {
    title: "Markup",
    shortcuts: [
      { keys: "# ", label: "Heading" },
      { keys: "```lang", label: "Code block, highlighted in that language" },
      { keys: "::text::", label: "Highlight" },
      { keys: "[[Title]]", label: "Link to another note" },
      { keys: "- [ ]", label: "To-do" },
    ],
  },
];
