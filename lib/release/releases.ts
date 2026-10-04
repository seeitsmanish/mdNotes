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
    version: "1.43.0",
    date: "2026-10-04",
    title: "Write offline without losing a word",
    changes: [
      "Lose your connection mid-sentence and keep typing: mdNotes says it is offline, keeps your words on this device, and syncs them the moment you are back.",
      "Even if your phone closes the app while you are offline, your edits are sent the next time you open it. If the same note changed somewhere else meanwhile, your version is kept as a separate copy — nothing is overwritten.",
    ],
  },
  {
    version: "1.42.0",
    date: "2026-10-04",
    title: "Templates and captions",
    changes: [
      "Type /template for a ready-made page: Daily note (with today's date), Meeting notes, Interview prep (with a rounds table) or Checklist.",
      "Images now show their description as a caption underneath — write it inside the brackets: ![like this](…).",
    ],
  },
  {
    version: "1.41.0",
    date: "2026-10-04",
    title: "Checklist progress at a glance",
    changes: [
      "Notes with to-dos show how far along they are in the list — a small ring and 3/7 — and turn green when everything is ticked.",
    ],
  },
  {
    version: "1.40.0",
    date: "2026-10-04",
    title: "Swipe for actions",
    changes: [
      "On your phone, swipe a note in the list from right to left for More and Delete, just like iPhone Mail. A long swipe deletes it straight away (with Undo).",
      "More lets you pin, share, copy or duplicate a note without opening it. In Trash, swipe to restore or delete for good.",
      "The pictures on empty screens now sit properly in the centre of their circle.",
    ],
  },
  {
    version: "1.39.0",
    date: "2026-10-04",
    title: "Pictures in the list",
    changes: [
      "A note with an image now shows a small thumbnail of it in the note list, so screenshot and whiteboard notes are easy to spot.",
    ],
  },
  {
    version: "1.38.0",
    date: "2026-10-04",
    title: "Tap an image to see it",
    changes: [
      "Tap any image in a note to see it full screen; tap it again to zoom in. Close with ✕, Esc or a tap outside.",
      "To change the image's markdown, tap Edit in the viewer.",
    ],
  },
  {
    version: "1.37.0",
    date: "2026-10-04",
    title: "Emoji",
    changes: [
      "Type a colon and a word — :fire, :done, :idea — to drop in an emoji 🔥✅💡.",
      "Or tap the smiley in the formatting bar for a grid of them, grouped and easy to browse on a phone.",
    ],
  },
  {
    version: "1.36.0",
    date: "2026-10-04",
    title: "A livelier mdNotes",
    changes: [
      "Notes glide in when you open them, and on your phone the note and the list slide past each other instead of jumping.",
      "Rows rise into the list, buttons respond to a press, and ticking a to-do gives a small pop.",
      "Empty screens have illustrations instead of a line of grey text.",
      "If your device is set to reduce motion, all of this stays still.",
      "Choosing Notes, Pinned or Trash now closes that menu.",
    ],
  },
  {
    version: "1.35.0",
    date: "2026-10-04",
    title: "Copy as HTML",
    changes: [
      "Copy as HTML (in a note's ⋯ menu) pastes into Gmail, Google Docs or Slack with its headings, lists, links, tables and code intact — or as HTML source into a code editor.",
      "If a note fails to open, it now says so with Try again, instead of quietly showing the empty screen.",
      "Code blocks line up with the text around them instead of sticking out to the left.",
    ],
  },
  {
    version: "1.34.0",
    date: "2026-10-04",
    title: "Tighter security headers",
    changes: [
      "mdNotes now insists on HTTPS, refuses changes sent from any other website, and tells browsers never to keep copies of your notes in their cache. Nothing changes in how you use it.",
    ],
  },
  {
    version: "1.33.0",
    date: "2026-10-04",
    title: "Link to a note without remembering its title",
    changes: [
      "Type [[ and pick from your notes' titles — keep typing to narrow the list. The link is written exactly, so it always opens the right note.",
    ],
  },
  {
    version: "1.32.0",
    date: "2026-10-04",
    title: "Fold a section",
    changes: [
      "Collapse everything under a heading with the small arrow after it, and tap the … to open it again — handy in long notes with a section per topic.",
    ],
  },
  {
    version: "1.31.0",
    date: "2026-10-04",
    title: "Search takes you to the words",
    changes: [
      "Opening a note from a search now jumps to the first place your words appear, and highlights every other one — no more scrolling a long note to find them.",
    ],
  },
  {
    version: "1.30.0",
    date: "2026-10-04",
    title: "Fresh when you come back",
    changes: [
      "Switching back to mdNotes — on your phone or another tab — now picks up changes made elsewhere: the list refreshes, and an open note you have not edited shows its latest text.",
    ],
  },
  {
    version: "1.29.0",
    date: "2026-10-04",
    title: "Type / to add a block",
    changes: [
      "Type / at the start of a line for a menu of headings, to-dos, lists, quotes, code, tables, dividers, spoilers, links and images. Keep typing to narrow it — /todo, /table, /h2.",
    ],
  },
  {
    version: "1.28.0",
    date: "2026-10-04",
    title: "Share, copy and duplicate a note",
    changes: [
      "A note's ⋯ menu can now Share it (on your phone, to any app), Copy it as Markdown, Duplicate it, or download it as a .md file.",
      "Tap a #tag to search for every note that has it.",
    ],
  },
  {
    version: "1.27.0",
    date: "2026-10-04",
    title: "mdNotes",
    changes: [
      "The app is now called mdNotes, and will live at www.mdnotes.in. Backups are named mdnotes-<date>.zip.",
      "On the new address you will sign in once, and an installed phone app should be removed and installed again from there.",
    ],
  },
  {
    version: "1.26.0",
    date: "2026-10-04",
    title: "A tidier list, and headings that line up",
    changes: [
      "Headings now line up exactly with the text under them. A hidden space was nudging them a little to the right.",
      "The note list is grouped by when you last edited: Pinned, Today, Yesterday, Previous 7 days and so on.",
      "Previews read as text: a table shows \"Company · Round · Result\" instead of pipes, and an image shows its name.",
      "On a phone, New note is a round button at the bottom right, where your thumb already is.",
      "The sign-in page and the empty screen show the new myNotes mark, and the empty screen has a New note button.",
      "Dates follow your own timezone — a note edited just after midnight is under Today, not Yesterday — and \"just now\" keeps counting while the app is open. This also stops the page quietly redrawing itself as it loads.",
    ],
  },
  {
    version: "1.25.0",
    date: "2026-10-04",
    title: "myNotes, and a better phone layout",
    changes: [
      "The app is now called myNotes, with a new icon: a page of notes. On an iPhone, remove the home-screen icon and add it again to get the new one.",
      "On a phone, an open note's top bar is just Back, Pin and a ⋯ menu (History, Outline, Move to trash), so it is no longer crowded.",
      "The Appearance button is on the note list too, so What's new, export and sign out are there without opening a note. What's new is now first in the panel.",
      "Wide tables scroll sideways inside their frame instead of squeezing every column to one word per line.",
      "The formatting bar scrolls all the way to its last buttons, and its fade moves to show which way there is more.",
    ],
  },
  {
    version: "1.24.0",
    date: "2026-10-04",
    title: "Spoilers",
    changes: [
      "Wrap text in ||double bars|| to hide it — the answer to a question, say. It shows blurred until you tap its line, and hides again when you move on.",
      "⌘⇧E hides the selected text, and pressing it again shows it. Note titles and previews in the list show ▒▒▒ instead, so an answer never leaks there.",
      "Pressing bold, italic or highlight a second time now removes it, as you would expect, instead of adding another layer.",
    ],
  },
  {
    version: "1.23.2",
    date: "2026-10-03",
    title: "Easier to read",
    changes: [
      "The lighter grey text — dates, previews, word counts — is a little stronger in every theme, so it is comfortable to read, not just visible.",
      "Screen readers now announce the editor and the appearance sliders by name.",
    ],
  },
  {
    version: "1.23.1",
    date: "2026-10-03",
    title: "Every setting within reach",
    changes: [
      "The Appearance panel now scrolls. On a phone or a smaller laptop screen its lower half — export, import, install and sign out — was cut off and could not be reached.",
    ],
  },
  {
    version: "1.23.0",
    date: "2026-10-03",
    title: "Clean up images you no longer use",
    changes: [
      "Images left behind by deleted notes can now be cleared from Appearance, which shows how many there are and how much space they take.",
      "Anything still shown in a note — or in an earlier version of one — is always kept.",
    ],
  },
  {
    version: "1.22.0",
    date: "2026-10-03",
    title: "A tighter lock on the page",
    changes: [
      "Ursa now only runs code it issued for that exact page load, so text that somehow slipped into a page could not run as a program. Nothing changes in how you use it.",
    ],
  },
  {
    version: "1.21.2",
    date: "2026-10-03",
    title: "Housekeeping",
    changes: ["Behind-the-scenes tidying of the tools Ursa is built with. Nothing changes in how it works."],
  },
  {
    version: "1.21.1",
    date: "2026-10-03",
    title: "Stronger protection for your password",
    changes: [
      "After ten wrong passwords from one place, sign-in pauses for ten minutes — and that now holds reliably, where before it could reset on its own.",
    ],
  },
  {
    version: "1.21.0",
    date: "2026-10-03",
    title: "Problems leave a trace",
    changes: [
      "When something goes wrong in the app, it is now recorded so it can be found and fixed, instead of failing silently.",
      "If a screen ever crashes, you get a clear message and a Reload button instead of a blank page.",
    ],
  },
  {
    version: "1.20.0",
    date: "2026-10-03",
    title: "Share to Ursa from any app",
    changes: [
      "With Ursa installed on your phone, it appears in the share sheet: share a link, an article or a message and it becomes a note.",
      "You see what will be saved, and can edit it, before tapping Save.",
      "Long-press the Ursa icon on your home screen for New note or Search.",
    ],
  },
  {
    version: "1.19.0",
    date: "2026-10-03",
    title: "Sign out, everywhere",
    changes: [
      "There is now a Sign out button in Appearance, and Sign out everywhere, which signs out every device and anyone using a copied sign-in.",
      "Changing your password now signs out every device automatically.",
      "You will need to sign in once after this update.",
    ],
  },
  {
    version: "1.18.1",
    date: "2026-10-03",
    title: "Backups include your images",
    changes: [
      "Exporting your notes now includes the images in them, so a backup is complete.",
      "Importing that backup puts the images back in the notes that show them.",
      "The exported files also show their images in other apps, like Obsidian.",
    ],
  },
  {
    version: "1.18.0",
    date: "2026-10-03",
    title: "Undo, even after you have moved on",
    changes: [
      "Every note now keeps its earlier versions. Open History from the toolbar to see them and put one back.",
      "If you accidentally delete most of a note — a bad paste, select-all by mistake — the text from just before is always kept.",
      "Before you restore, Ursa shows exactly which lines would come back. Restoring keeps your current text too, so you can change your mind.",
    ],
  },
  {
    version: "1.17.0",
    date: "2026-10-03",
    title: "Install Ursa on your phone",
    changes: [
      "Ursa can now be installed as an app: an icon on your home screen that opens full screen, without the browser around it.",
      "Find “Install as an app” in Appearance or the command palette. On iPhone it shows you the two taps in Safari: Share, then Add to Home Screen.",
      "With no connection, the app tells you it is offline instead of showing a browser error. Your notes are never kept out of date on the device.",
    ],
  },
  {
    version: "1.16.0",
    date: "2026-10-03",
    title: "Better on your phone",
    changes: [
      "Buttons are big enough to hit with a thumb.",
      "Notes use the width of your screen instead of a narrow column in the middle.",
      "The formatting bar stays above the keyboard, and scrolls sideways when it does not fit.",
      "Swiping back, or Android's back button, returns to your list instead of leaving Ursa.",
      "The hidden pin and trash buttons on each list row are gone on touch screens, so a stray tap can no longer trash a note.",
    ],
  },
  {
    version: "1.15.3",
    date: "2026-10-03",
    title: "No more flash of the old theme",
    changes: [
      "Opening Ursa could briefly show your previous theme — or the default accent colour — before switching to the one you chose. It now opens in your theme and colours from the very first frame.",
    ],
  },
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
