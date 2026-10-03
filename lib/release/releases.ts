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
    version: "1.15.2",
    date: "2026-10-03",
    title: "Drill mode removed",
    changes: [
      "Drill mode is gone: no Drill button, no ⌘⇧L. Your notes were never changed by it and are exactly as you wrote them.",
    ],
  },
  {
    version: "1.15.1",
    date: "2026-10-03",
    title: "Buttons that show they are working",
    changes: [
      "Clicking New note several times while it loads no longer creates several notes.",
      "New note, pin, trash, restore and delete show a spinner while they work and cannot be pressed twice.",
      "Opening a note dims the editor until it has loaded.",
      "If one of these fails, you are told why instead of nothing happening.",
    ],
  },
  {
    version: "1.15.0",
    date: "2026-10-03",
    title: "Images in your notes",
    changes: [
      "Paste an image, drag one onto a note, or use the new image button on the format bar.",
      "Large photos are shrunk before they upload, so they arrive quickly and do not eat your storage.",
      "Your images are private: they are only shown to you, behind your password, never at a public link.",
    ],
  },
  {
    version: "1.14.0",
    date: "2026-10-03",
    title: "Drill mode (since removed)",
    changes: ["Added a drill mode for question lists. It was removed in 1.15.2."],
  },
  {
    version: "1.13.0",
    date: "2026-10-03",
    title: "Your notes can do the math",
    changes: [
      "End a line with = and the answer appears beside it: 12 * 4.5 = shows 54. Change a number and every answer updates.",
      "Give a number a name — rent = 1,450 — and use it in the lines below. Names can have spaces, like per person.",
      "Write total = under a list of amounts to add them up.",
      "It understands the way people write sums: 18% of 2,340, ₹1,200 x 3, or food: ₹900 * 4 with a label in front.",
      "Answers are shown, never typed into your note, and clicking one copies it.",
    ],
  },
  {
    version: "1.12.1",
    date: "2026-10-03",
    title: "Long list items line up",
    changes: [
      "When a numbered item, bullet or to-do runs onto a second line, the second line now starts under the item's text instead of back at the left edge under the number.",
    ],
  },
  {
    version: "1.12.0",
    date: "2026-10-03",
    title: "Editing on two devices no longer loses text",
    changes: [
      "If a note was open on two devices, saving on one could silently erase what you had just written on the other. That can no longer happen.",
      "When a device tries to save over a newer version of a note, the newer version stays and your edits are kept as a separate note named “Conflicted copy: …”, so you can compare the two and keep what you want.",
      "The device that fell behind switches to the latest text and tells you, with a button to open your copy.",
    ],
  },
  {
    version: "1.11.4",
    date: "2026-10-03",
    title: "Search finds what it was missing",
    changes: [
      "Searching for a word with an accent — café, crème, Ångström — now finds your notes. Before, it found nothing, even when you typed the word exactly as written.",
      "In a large library, a note titled with your search could be left out of the results entirely when hundreds of other notes mentioned the same word. It is now always found, and listed first.",
    ],
  },
  {
    version: "1.11.3",
    date: "2026-10-03",
    title: "An icon of its own",
    changes: [
      "Ursa now has an icon — the Big Dipper, from the constellation Ursa Major — so it is easy to spot among your browser tabs and looks right when added to a phone's home screen.",
    ],
  },
  {
    version: "1.11.2",
    date: "2026-10-03",
    title: "Security fixes",
    changes: [
      "Fixed a sign-in link that could send you to another website right after you entered your password.",
      "Links inside notes now open only if they are ordinary web or email links, so a note imported from elsewhere cannot carry a link that runs code.",
      "Ursa can no longer be embedded inside another website, which blocks tricks that get you to click things you cannot see.",
      "Importing a deliberately oversized zip no longer crashes the import; the oversized file is skipped and reported.",
    ],
  },
  {
    version: "1.11.1",
    date: "2026-10-03",
    title: "Every change is checked before it can ship",
    changes: [
      "Every change to Ursa is now type-checked, tested and built automatically before it can be released, so a broken build can no longer reach you by someone forgetting a step.",
    ],
  },
  {
    version: "1.11.0",
    date: "2026-10-03",
    title: "Backups you can actually restore from",
    changes: [
      "Export now streams, so it works on a large library instead of running out of memory on the one backup that mattered.",
      "Exported notes carry their id, creation date and pinned state, and importing them puts all of that back — a restore reproduces your library rather than flattening it.",
      "Notes exported from Bear or Obsidian still import cleanly; files without that metadata are treated as ordinary notes.",
      "A new command, pnpm backup, writes a dated archive to your own disk so a copy exists somewhere the host cannot delete.",
    ],
  },
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
