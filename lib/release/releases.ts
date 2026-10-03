/**
 * The changelog the app shows (PRD R7.4).
 *
 * Deliberately hand-written and committed rather than generated from git log:
 * commit messages are written for the repository, release notes are written for
 * the person using the app, and conflating the two produces notes nobody reads.
 *
 * Newest first. The first entry's version is what "unseen" is measured against.
 */

export interface Release {
  version: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  title: string;
  changes: string[];
}

export const RELEASES: Release[] = [
  {
    version: "1.10.0",
    date: "2026-10-03",
    title: "Fixes a note-truncation bug, and a round of defects",
    changes: [
      "Fixed a bug that could silently truncate a note: switching away and back while a save was still in flight could load the pre-edit text and then write it back over your edits. Unsaved text now always wins over a stale read.",
      "A failing save now backs off instead of retrying in a tight loop, and the last save of a session survives closing the tab.",
      "Headings and code blocks have their vertical spacing back — a CSS specificity bug had silently zeroed it.",
      "The checkbox tick was drawn in white, so it was invisible against the default mint accent. It now follows the accent.",
      "⌘K opened the command palette and inserted a link at the same time. Link is now ⌘⇧K.",
      "⌘⌫ no longer trashes the note while you are typing — it is delete-to-start-of-line again.",
      "The editor column is centred, so a wide window no longer pins the text to the left. Width → Full makes it span the whole pane.",
    ],
  },
  {
    version: "1.9.0",
    date: "2026-10-03",
    title: "Tables that look like tables",
    changes: [
      "Markdown tables now render as real tables — borders, aligned columns, a header row — instead of raw pipes.",
      "Column alignment set with :--- and ---: is respected.",
      "Bold, italic, code and links inside cells render properly.",
      "Click a table and it turns back into markdown so you can edit it, exactly like syntax markers on the line you are editing.",
    ],
  },
  {
    version: "1.8.0",
    date: "2026-10-03",
    title: "Find your way around a long note",
    changes: [
      "An outline panel lists the headings in the note you are reading; click one to jump to it.",
      "The section you are editing is highlighted, so the outline shows where you are, not just what exists.",
      "Toggle it with ⌘⇧O. Headings inside code blocks are correctly left out.",
    ],
  },
  {
    version: "1.7.0",
    date: "2026-10-03",
    title: "Emptying the trash, and finding the shortcuts",
    changes: [
      "Trash can now be emptied. It asks first and tells you how many notes will go, and it never empties itself on a timer.",
      "Press ⌘/ for a list of every keyboard shortcut, grouped by what it does.",
      "The shortcut list also covers the markup worth knowing — code blocks, highlights and [[links]].",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-10-03",
    title: "Search that finds the right note",
    changes: [
      "Results are ranked: a note titled after what you searched for comes before one that merely mentions it.",
      "Each result shows the text around the match with your words highlighted, instead of the note's opening line.",
      "Searching several words finds notes containing all of them, in any order.",
      "Accents are ignored, so searching cafe finds Café.",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-10-03",
    title: "Notes that point at each other",
    changes: [
      "Write [[Note title]] to link to another note — the same syntax Bear, Obsidian and Roam use, so notes written elsewhere link correctly here.",
      "Links match titles loosely, ignoring case and extra spaces, because nobody retypes a title exactly.",
      "A link to a note that does not exist is shown as unresolved rather than broken, and offers to create it.",
      "Each note now shows which other notes link to it, along the bottom.",
      "Fixed: a problem reading appearance settings could blank the whole app; notes now load even if settings do not.",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-10-03",
    title: "Import",
    changes: [
      "Import notes from a .zip of markdown files, or from loose .md files, via Appearance → Import notes.",
      "Works with anything that exports markdown, including Bear and Obsidian, and with Ursa's own export.",
      "Import only ever adds notes — it never overwrites an existing one, so a bad import cannot destroy your work.",
      "You are told exactly how many notes were created and which files were skipped and why.",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-10-03",
    title: "Your notes, in your hands",
    changes: [
      "Export every note as a .zip of markdown files, from Appearance → Export all notes or the ⌘K palette.",
      "Export just the note you are reading as a single .md file.",
      "Exports are the raw markdown exactly as stored, so Bear, Obsidian or any text editor reads them straight back.",
      "Notes in Trash are left out of exports, and notes sharing a title get numbered rather than overwriting each other.",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-10-03",
    title: "Accounts of one, and a changelog",
    changes: [
      "The app is now password-protected and deployed, so your notes are reachable from any device.",
      "Appearance follows you between devices — theme, accent, radius and typeface are stored server-side rather than per-browser.",
      "Pane width, focus mode and text size stay per-device on purpose, since the right value differs between a laptop and a phone.",
      "This dialog: see the running version and what changed in each release.",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-10-03",
    title: "A real editor",
    changes: [
      "Fenced code blocks are parsed in the language they declare, so ```json is genuinely highlighted as JSON — about thirty languages, loaded on demand.",
      "Rebuilt the editor on CodeMirror's Lezer parser: parsing is now incremental, so large notes stay responsive.",
      "Added tables, list continuation on Enter, smart paste of links, and a floating format bar.",
      "Search, a ⌘K command palette, focus mode, and undo when a note is trashed.",
      "Five themes plus an accent colour picker, adjustable width, padding, text size and typeface.",
      "Tagging was removed as a way of organising notes; #tags still style themselves but no longer file anything.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-10-03",
    title: "First version",
    changes: [
      "Single-pane markdown editing: markdown styles itself as you type, with syntax markers shown only on the line you are editing.",
      "Notes autosave as you write — there is no save button.",
      "Pin, trash and restore, with trash kept until you empty it.",
    ],
  },
];

export const CURRENT_RELEASE = RELEASES[0]!;

/** Build identity, injected at build time by next.config.ts. */
export const BUILD = {
  version: process.env.NEXT_PUBLIC_APP_VERSION ?? CURRENT_RELEASE.version,
  commit: process.env.NEXT_PUBLIC_COMMIT_SHA ?? "dev",
};
