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
      { keys: "⌘⇧Space", label: "Quick note to Inbox" },
      { keys: "⌘P", label: "Pin or unpin" },
      { keys: "⌘⌫", label: "Move to trash" },
    ],
  },
  {
    title: "Getting around",
    shortcuts: [
      { keys: "⌘K", label: "Command palette" },
      { keys: "⌘F", label: "Find in this note (search notes from the list)" },
      { keys: "⌘⇧F", label: "Search all notes" },
      { keys: "⏎ / ⇧⏎", label: "Next or previous match while finding" },
      { keys: "⌘0", label: "Focus the note list" },
      { keys: "⌘1 … ⌘9", label: "Focus editor group 1 … 9 (⌘ one past the last makes a new group)" },
      { keys: "↑ ↓", label: "Move through the list" },
      { keys: "⌘.", label: "Focus mode" },
      { keys: "⌘⇧O", label: "Show or hide the outline" },
      { keys: "⌘/", label: "This dialog" },
    ],
  },
  {
    title: "Tabs and editor groups",
    shortcuts: [
      { keys: "Click / double-click", label: "Open a note as a preview / keep it" },
      { keys: "Middle-click", label: "Open a note in a new tab; close a tab" },
      { keys: "⌥-click", label: "Open a note to the side" },
      { keys: "Drag", label: "Move a tab or note; onto a group’s edge to split (⌥ copies, ⇧ drops a link)" },
      { keys: "⌘\\", label: "Split editor right" },
      { keys: "⌘K ⌘\\", label: "Split editor down (also ⌘⇧\\)" },
      { keys: "⌃1 … ⌃9", label: "Open the n-th tab (Alt+1 … 9 on Windows); 9 is the last" },
      { keys: "⌃PageDown / ⌃PageUp", label: "Next / previous tab (also ⌥⌘→ ⌥⌘←, ⌘⇧] ⌘⇧[)" },
      { keys: "⌥W", label: "Close tab (⌘W in the installed app)" },
      { keys: "⌥⇧T", label: "Reopen closed tab (⌘⇧T in the installed app)" },
      { keys: "⌃⌘→ / ⌃⌘←", label: "Move tab into next / previous group (Ctrl+Alt+→ ← on Windows)" },
      { keys: "⌘K ⌘W", label: "Close all tabs, in the installed app (in a browser tab ⌘W closes the tab; use ⌘K → Close All Tabs)" },
      { keys: "⌘K ⏎ / ⌘K ⇧⏎", label: "Keep preview open / pin tab" },
      { keys: "⌘K ⌘M", label: "Maximize group (double-click a tab too)" },
      { keys: "⌘K ⌘← → ↑ ↓", label: "Focus the group on that side" },
      { keys: "⌥⌘0", label: "Flip editor layout" },
    ],
  },
  {
    title: "Writing",
    shortcuts: [
      { keys: "⌘B", label: "Bold" },
      { keys: "⌘I", label: "Italic" },
      { keys: "⌘⇧K", label: "Link" },
      { keys: "⌘⇧H", label: "Highlight" },
      { keys: "⌘⇧E", label: "Spoiler (hide until clicked)" },
      { keys: "⌘⇧C", label: "Inline code" },
      { keys: "⌘⇧X", label: "Strikethrough" },
      { keys: "⌘⇧7", label: "To-do" },
      { keys: "⌘⇧8", label: "Bulleted list" },
      { keys: "⌘⇧L", label: "Hide note titles (screen sharing)" },
      { keys: "⌘⌥[", label: "Fold the section at the caret" },
      { keys: "⌘⌥]", label: "Unfold it" },
      { keys: "⏎", label: "Continue a list or quote" },
    ],
  },
  {
    title: "Markup",
    shortcuts: [
      { keys: "# ", label: "Heading" },
      { keys: "```lang", label: "Code block, highlighted in that language" },
      { keys: "::text::", label: "Highlight" },
      { keys: "||text||", label: "Spoiler — hidden until you click its line" },
      { keys: "[[Title]]", label: "Link to another note" },
      { keys: "12 * 4 =", label: "Live math — the answer appears after =" },
      { keys: "rent = 1,450", label: "Name a number to use further down" },
      { keys: "- [ ]", label: "To-do" },
    ],
  },
];
