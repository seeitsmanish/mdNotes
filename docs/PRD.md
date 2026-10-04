# Ursa — Product Requirements Document

A web clone of [Bear](https://bear.app): a single-pane markdown notes app where
you type markdown and it styles itself in place.

- **Status:** v1.1 in development
- **Owner:** Manish Sharma
- **Stack:** Next.js (App Router) + TypeScript + Tailwind, PostgreSQL via Prisma, Docker for local Postgres
- **Companion doc:** [TECH-SPEC.md](./TECH-SPEC.md)

## Revision history

| Version | Change |
|---|---|
| v1.0 | Three-pane shell, live editor, `#tag` organisation with a nested tag tree |
| **v1.1** | **Tagging removed as an organising system.** Two-pane shell with search. Effort redirected into the editor, UX and typography — see §2 |
| **v1.2** | Password gate (single password, signed cookie). Deployed to Vercel on Neon Postgres. Appearance synced to the database — §4.6 |

---

## 1. Problem

Bear is excellent and Apple-only. There is no good browser-based equivalent that
keeps the thing that makes Bear feel different from every other notes app:

**No preview pane.** You type markdown and it styles itself in place. The syntax
markers stay visible on the line you're editing and disappear on the lines you're
not. You are never editing a different document than the one you read.

v1.0 treated tags as the second pillar. v1.1 drops that: organisation by tag was
cut, and the effort went into making the editor itself worth using.

## 2. Goals & non-goals

### Goals

| # | Goal | Why it matters |
|---|------|----------------|
| G1 | Writing feels immediate — keystroke to styled glyph with no visible reflow | The whole premise of single-pane editing collapses if the text jumps |
| G2 | A fenced block is really parsed in its language | Grey text in a ```json block is the clearest sign an editor is faking it |
| G3 | Nothing is ever lost — autosave, no save button, no "unsaved changes" modal | Trust is the baseline feature of a notes app |
| G4 | The shell is keyboard-navigable end to end | Power users never touch the mouse |
| G5 | The app looks finished — restrained colour, consistent spacing, real icons | A notes app you live in has to feel calm |

### Non-goals

- **Tags as organisation.** Cut in v1.1. `#tag` still *styles* as a pill so notes
  written in Bear look right, but it files nothing, is not clickable, and has no
  sidebar, no rename, no filtering. There is no tag table in the database.
- Accounts, auth, multi-user. Single-user against a local Postgres.
- Sync, conflict resolution, offline queueing.
- Wiki-links (`[[Note]]`) and backlinks.
- Export (`.md`, `.textbundle`, PDF) and import from a real Bear library.
- Attachments and images.

## 3. Users

**The markdown note-taker.** Already writes markdown by hand, wants it in a
browser on a non-Apple machine. Judges the app in the first thirty seconds
entirely on whether the editor feels right.

## 4. Scope

### 4.1 Two-pane shell

```
┌──────────────────────┬───────────────────────────────────────┐
│ Notes             ＋ │  Edited 4h ago · 64 words      ○ 🗑 ◫ ◐│
│ ┌──────────────────┐ │                                       │
│ │ ⌕ Search         │ │  # Fenced code gets real highlighting │
│ └──────────────────┘ │                                       │
│ [ All 7 ][Pinned][🗑]│  ┌───────────────────────────────────┐│
│                      │  │ JSON                              ││
│ ● Welcome to Ursa    │  │ {                                 ││
│   4h ago · A web…    │  │   "name": "ursa",                 ││
│                      │  │   "private": true                 ││
│   Groceries          │  │ }                                 ││
│   1h ago · oat milk  │  └───────────────────────────────────┘│
└──────────────────────┴───────────────────────────────────────┘
      320px, drag                      fluid
```

- R1.1 Pane header, search field, and an All / Pinned / Trash segmented control
  carrying live counts.
- R1.2 Search filters on every keystroke, debounced 220ms, matching note bodies
  (and therefore titles and excerpts, which are derived from them).
- R1.3 Rows show title, relative modified time and a one-line excerpt. Sorted by
  modified desc; pinned first.
- R1.4 Rows are **inset and rounded**, and the selected row is an accent *tint*
  with an accent title — not a saturated block. At list density the selection
  should read as "this one", not shout.
- R1.5 The list pane is drag-resizable (260–520px) and the width persists.
- R1.6 Below 900px the shell shows one pane at a time with back navigation.
- R1.7 Focus mode (`⌘.`) hides the list entirely, leaving only the editor.

### 4.2 The editor

**Supported syntax** — CommonMark + GFM + Bear's own additions:

| Construct | Syntax |
|---|---|
| Headings | `# ` … `###### ` |
| Bold / italic | `**bold**`, `*italic*`, and Bear's `/italic/` |
| Strikethrough | `~~struck~~` |
| Highlight | `::highlighted::` |
| Inline code | `` `code` `` |
| Fenced code | ` ```lang ` — **parsed in that language** |
| Quote | `> ` |
| Todo | `- [ ]` / `- [x]`, clickable checkbox |
| Lists | bullets, ordered, nested |
| Tables | GFM pipe tables |
| Links | `[text](url)` and bare URLs |
| Tag | `#tag` — styled as a pill, files nothing (§2) |

**Requirements**

- R2.1 **Marker reveal.** Markers are hidden when the caret is off their line and
  shown when on it. Hiding must not change line height.
- R2.2 **Real syntax highlighting inside fences.** A fence tagged with a language
  is parsed in that language and its tokens coloured. The fence's own backticks
  are hidden and replaced by a small language chip, so the block reads as a
  labelled container rather than a row of grey punctuation.
- R2.3 Todo checkboxes are clickable and rewrite the underlying `- [ ]` text. A
  todo's list bullet is hidden, since the checkbox already marks the row.
- R2.4 Autosave debounced at 400ms idle, plus a flush on blur, on note switch,
  and on `visibilitychange` → hidden. An indicator appears only on failure.
- R2.5 Typing in a 50k-character note stays at 60fps. The parse is incremental
  and decorations are built only over the viewport.
- R2.6 Markdown shortcuts: `⌘B` bold, `⌘I` italic, `⌘K` link, `⌘⇧H` highlight,
  `⌘⇧C` inline code, `⌘⇧X` strike, `⌘⇧7` todo.
- R2.7 Enter continues a list, quote or todo onto the next line.
- R2.8 Pasting a URL over a selection makes a link of it rather than replacing
  the words.
- R2.9 A live word count sits in the toolbar.
- R2.10 *(v1.12.1)* A list item that wraps continues under its own text, not
  under its number or bullet. The indent is the measured width of the visible
  prefix in the editor's font — `14. `, `- `, or the checkbox of a to-do — so
  it holds for any typeface, size and nesting depth.

### 4.3 Appearance

- R3.1 Five themes — Light, Sepia, Graphite, Midnight — plus System, which follows
  `prefers-color-scheme`. Every colour is a token; nothing is hardcoded.
- R3.2 Editor measure is selectable: Narrow / Regular / Wide / Full.
- R3.3 Editor text size is adjustable, 13–22px.
- R3.4 Editor typeface is selectable: sans, serif, mono.
- R3.5 All of the above persist per browser and apply before first paint, so the
  app never flashes the wrong theme.

### 4.4 Note lifecycle

- R4.1 `⌘N` creates a note and focuses the editor. A note created but never typed
  into is discarded rather than left as a blank row.
- R4.2 Pin / unpin from the row or `⌘P`.
- R4.3 Delete moves to Trash (soft delete). Trash rows offer Restore and Delete
  Permanently. **Trashing shows an undo toast** — destructive actions in this app
  are reversible, and that should be visible.
- R4.4 Title is derived, never a separate field: first heading if the note starts
  with one, else the first non-empty line, `"Untitled"` when empty. Fence lines
  never contribute, so a note that opens with ```` ```json ```` shows its code,
  not its backticks.

### 4.5 Command palette

- R5.1 `⌘K` opens a palette that jumps to a note by title or runs a command.
- R5.2 Note matching is over the titles already loaded in the list pane, so the
  palette never waits on the network.

### 4.6 Appearance follows the account, not the browser

Appearance was per-browser in v1.1, which meant opening the app on a phone lost
the theme chosen on a laptop. v1.2 splits it by what the setting actually is.

- R6.1 **Identity settings sync**: theme, accent colour, radius, heading mode,
  editor width, padding and typeface persist in the database and follow the
  single user to any device.
- R6.2 **Device settings stay local**: pane width, focus mode and text size
  remain in `localStorage`, because the right value genuinely differs between a
  laptop, an external monitor and a phone.
- R6.3 **No flash.** The stored theme must apply before first paint. The DB is
  the source of truth, but `localStorage` keeps a copy purely as a paint-time
  cache so the inline bootstrap script has something synchronous to read.
  *(v1.15.3)* For a signed-in request the server renders the theme, accent,
  radius, heading colour and `dark` class straight into `<html>`, and the
  bootstrap only fills in what the server did not (the sign-in page). Before
  this, a stale cache painted the previous theme for ~120 ms, and a custom
  accent always arrived ~150 ms after first paint. Server and client derive
  the values from one function, `appearanceVars()`, so they cannot disagree.
- R6.4 Writes are **fire-and-forget and debounced**: dragging the radius slider
  must not issue a request per frame, and a failed sync must never block the UI
  or lose the local change.
- R6.5 Settings live in a single row. There are no accounts (PRD §2), so a
  `userId` column would be a column of one value.

### 4.7 Release notes in the app

Shipping continuously is only useful if you can tell what changed. v1.2 adds a
visible version and a changelog you read without leaving the app.

- R7.1 The running version is visible in the UI, together with the commit it was
  built from, so a bug report can name an exact build.
- R7.2 A **What's new** dialog lists releases newest-first: version, date, and
  what changed in plain language.
- R7.3 A release the user has not seen is marked. The marker clears on open and
  never nags — no modal on load.
- R7.4 Releases are a committed, typed array, not free text scraped from git.
  Commit messages are written for the repo; release notes are written for the
  person using the app, and conflating them produces notes nobody can read.
- R7.5 Every release is tagged in git, so the tag, the version in the UI and the
  changelog entry cannot drift apart.

### 4.8 Export and backup

Notes you cannot get out are notes you do not really own. There is no backup of
the hosted database, so export is the only recovery path that exists.

- R8.1 **Export everything** as a `.zip` of `.md` files, one per note, named
  after the note's title.
- R8.2 **Export one note** as a `.md` file from the command palette.
- R8.3 Exported files are the raw markdown exactly as stored — no conversion, no
  re-serialisation. What comes out is what Bear, Obsidian or a text editor reads.
  *One exception since v1.18.1:* image links are rewritten to the image's path
  inside the archive (§4.29), because the app's own URL means nothing outside
  it.
- R8.4 Filenames are made safe for every OS and **de-duplicated**: two notes
  titled "Groceries" must not silently become one file.
- R8.5 Trashed notes are excluded by default, with an option to include them —
  trash is where you put things you meant to delete.
- R8.6 Export is streamed and authenticated like every other route. An export
  endpoint that skipped the gate would hand the whole library to anyone.

### 4.9 Import

Export without import is a one-way door. Import also makes the Bear migration
in §7 real: Bear exports markdown, and this reads markdown.

- R9.1 Accept a `.zip` of markdown files, or loose `.md`/`.markdown`/`.txt`
  files, in one drop.
- R9.2 Each file becomes one note, body byte-for-byte as in the file. Title and
  excerpt are derived on write like any other note — the filename is not the
  title, because the heading inside the file is more reliable.
- R9.3 **Import never overwrites.** Every file creates a new note. A merge that
  guesses which existing note a file corresponds to will eventually guess wrong,
  and the cost of guessing wrong is a destroyed note.
- R9.4 Report what happened: how many notes were created, and which files were
  skipped and why. A silent import is indistinguishable from a broken one.
- R9.5 Non-markdown entries, directories, macOS `__MACOSX` metadata and empty
  files are skipped rather than imported as empty notes.
- R9.6 Bounded: a cap on file count and total size, so a large or hostile upload
  cannot exhaust the server.

### 4.10 Wiki-links and backlinks

Notes become more useful when they can point at each other. `[[Title]]` is the
convention Bear, Obsidian and Roam all share, so notes written elsewhere link
correctly here without editing.

- R10.1 `[[Note title]]` in a body renders as a link and opens that note.
- R10.2 Matching is by title, case-insensitively and whitespace-insensitively,
  because nobody retypes a title exactly.
- R10.3 A link to a note that does not exist renders **differently** — unresolved,
  not broken — and clicking it offers to create that note. A link that silently
  does nothing is worse than no link.
- R10.4 `[[` inside code spans and fenced blocks stays literal, like every other
  construct.
- R10.5 **Backlinks**: the note being read shows which notes link *to* it. This
  is the half that makes linking worth doing — forward links you already know
  about, because you typed them.
- R10.6 Backlinks resolve on read rather than being stored in a join table.
  There is no second source of truth to keep in step with the text, which is the
  same reason tags were derived rather than stored in v1.0.

### 4.11 Search that earns its place

With tags gone (§2), search is the only way to find a note. v1.1 shipped the
minimum — a substring match in modified order — which answers "does this word
appear" but not "which note did I mean".

- R11.1 **Rank** results: a match in the title outranks a match in the body, and
  an earlier match outranks a later one. Recency breaks ties, not the ordering.
- R11.2 **Show the match**: a result displays the text around the hit with the
  matched term marked, rather than the note's opening line, which is often
  identical across results and tells you nothing.
- R11.3 Multi-word queries match notes containing **all** the terms, in any
  order and anywhere in the note.
- R11.4 Matching is case- and accent-insensitive: searching `cafe` finds `Café`.
- R11.5 Ranking happens where the text is, not in the client. The client must
  never need the full body of every note to order a list.
- R11.6 *(v1.11.4)* No note is dropped from results by the size of the library.
  Title matches and body matches are read separately, each capped at 500 and
  newest-first, so a note titled with the query is always a candidate however
  many notes merely mention it, and the cap is deterministic. Before this, 500
  passing mentions hid the note titled "Zebra" from a search for `zebra`.
- R11.7 *(v1.11.4)* Accent-insensitivity holds in the database, not only in
  ranking. Terms were folded (`café` → `cafe`) but the stored text was not, so
  the SQL that picks candidates never matched an accented note: `café` found
  nothing even typed exactly. The query now folds the column with
  `translate()`, using a table generated from the same `fold()` as ranking.

### 4.12 Trash you can actually empty

Trash has been append-only since v1.0: notes go in and nothing takes them out.
PRD §8 asked whether it should auto-expire; the answer is no — silently deleting
someone's notes on a timer is the kind of helpfulness nobody asked for.

- R12.1 **Empty trash** removes every trashed note permanently, on an explicit
  action, never on a timer.
- R12.2 It asks first, and says how many notes will go. "Are you sure?" with no
  number is a dialog people click through without reading.
- R12.3 The control appears only when there is something in the trash.

### 4.13 Keyboard reference

Roughly fifteen shortcuts exist and none are discoverable. A shortcut nobody
can find is a shortcut nobody uses.

- R13.1 `⌘/` opens a dialog listing every shortcut, grouped by what it acts on.
- R13.2 It is also reachable from the command palette, for people who do not
  know the shortcut that shows the shortcuts.
- R13.3 The list is derived from one definition shared with the keymap, so a
  shortcut cannot be renamed in one place and stale in the other.

### 4.14 Outline

A long note is currently a scroll. Notes that are structured — a list of
questions, a set of topics — are exactly the ones worth navigating, and their
headings already describe that structure.

- R14.1 A panel lists the note's headings, nested by level, and clicking one
  scrolls to it.
- R14.2 The heading containing the caret is marked, so the panel says where you
  are as well as what exists.
- R14.3 It appears only when a note has enough headings to be worth navigating —
  an outline of one item is furniture, not a feature.
- R14.4 It is derived from the same syntax tree the editor renders, not a second
  markdown parse, so the outline cannot disagree with the document.
- R14.5 Toggled with ⌘⇧O, and the choice persists per device.

### 4.15 Tables

*Written retrospectively: v1.9.0 shipped this without its PRD section. Recorded
from the commit that built it.*

A table styled as monospace text is a wall of pipes. Tables are the one
construct where in-place styling has to replace whole lines rather than hide a
few markers.

- R15.1 A GFM pipe table renders as a real table — borders, a header row,
  aligned columns — when the caret is outside it.
- R15.2 Column alignment from `:---` / `---:` / `:---:` is respected.
- R15.3 Inline markup inside cells (bold, italic, code, links) renders.
- R15.4 Clicking into a table turns it back into markdown. The document stays
  the source of truth; there is deliberately no grid editor.
- R15.5 Cell splitting is a pure, separately tested module: escaped pipes,
  missing outer pipes and ragged rows each shift every later column if handled
  wrongly.
- R15.6 Cells are built as DOM nodes, never `innerHTML` — a table is exactly
  where someone pastes content from elsewhere.

### 4.16 Backup and restore

Export has been the only recovery path since §4.8, and it was not good enough
to be one: it dropped pins and dates, and it built the whole archive in memory,
so it would fail on exactly the library large enough to be worth saving.

- R16.1 Export is **streamed**, so archive size is bounded by the library, not
  by the memory of one serverless function.
- R16.2 Export is **lossless**: each file carries YAML frontmatter with the
  note's id, creation time, last edit and pinned state.
- R16.3 Import reads that frontmatter and restores pinned state and creation
  time, so a restore reproduces the library rather than a flattened copy of it.
- R16.4 Frontmatter is not treated as note text. A file without frontmatter is
  still a valid note — anything exported from Bear or Obsidian must import
  cleanly.
- R16.5 A one-command local backup writes a dated archive to disk, so a backup
  can be scheduled by the user without depending on the hosting provider.

### 4.17 Continuous integration

`pnpm verify` existed but nothing ran it. A check that depends on someone
remembering is not a check. Running it on a clean machine also exposed that it
had never passed from a fresh clone: `typecheck` ran before the Prisma client
was generated, so it only ever worked on a machine that had already built once.

- R17.1 `pnpm verify` passes on a fresh clone after `pnpm install`, with no
  `.env` and no prior build — it generates the Prisma client first.
- R17.2 A GitHub Actions workflow runs `pnpm verify` on every push and every
  pull request.
- R17.3 CI installs with `--frozen-lockfile`, so a `package.json` change that
  was never locked fails CI rather than resolving differently in production.
- R17.4 CI needs no secrets and no database. `DATABASE_URL` is set to an
  unreachable placeholder because Prisma's config refuses to load without one;
  nothing in typecheck, the unit tests or the build connects to it. If a future
  change makes the build query the database, CI fails loudly instead of
  silently testing against something real.
- R17.5 Node and pnpm versions in CI match what the project is developed on
  (Node 22, pnpm 10).

Not done, deliberately: CI does not deploy. Deploying stays a manual step after
a green run (AGENT-LOOP §1 ⑥), because a deploy also needs the build SHA set in
Vercel and a read-only production check that a workflow cannot judge.

### 4.18 Two devices, one note

*Shipped in v1.12.0, reverted within the hour because `main` deploys on push
and production lacked the `version` column, then re-landed after the column
was added to Neon (a tested `ALTER TABLE ... ADD COLUMN`, applied through a
temporary branch first).*

Saving was unconditional: the last request to arrive replaced the body. With
the app open on a laptop and a phone, typing on one silently erased what the
other had saved — the user sees no error, and the overwritten text is gone.
The single-writer and stale-read fixes (v1.10) protect one device from itself;
they do nothing about a second device.

- R18.1 Every note carries a **version** that increases by one each time its
  body is saved. Pinning, trashing and restoring do not change it — they cannot
  conflict with text.
- R18.2 A body save names the version it was edited from. The server applies it
  only if that is still the current version, in one conditional `UPDATE`, so two
  saves cannot both pass the check.
- R18.3 **A stale save is never discarded.** The server keeps the newer text in
  the note and stores the stale text as a new note headed
  `# Conflicted copy: <title>`, in the same transaction. The response is a 409
  carrying both. This holds even for the last save of a closing tab, whose
  response nobody reads — which is why the copy is made on the server and not
  by the client.
- R18.4 The device that lost the race switches its editor to the current text
  and says so, with a way to open its own copy. Text typed while the losing save
  was in flight goes to the copy, not the note.
- R18.5 The copy's heading keeps its title distinct, so it never captures
  `[[wiki-links]]` meant for the original.
- R18.6 A save that names no version is applied unconditionally, as before.
  This keeps a tab opened before the upgrade working until it reloads.

Deliberately not done:

- **Merging.** A three-way merge of prose that guesses wrong corrupts both
  versions, and the cost of guessing wrong is the note. Keeping both and letting
  the person choose is slower and never destructive.
- **Live sync.** The other device does not learn about a change until it saves
  or reloads the note. Push updates are a larger change; this one closes the
  data loss.
- **Locking.** A lock held by a phone in someone's pocket would block the
  laptop, and nothing would release it.

### 4.19 Security hardening

From the audit in [SECURITY-AUDIT.md](./SECURITY-AUDIT.md). Each requirement
names the finding it closes.

- R19.1 The post-sign-in redirect only ever lands on this origin, however
  `next` is spelled (A1).
- R19.2 Links in notes open only if they are `http:`, `https:` or `mailto:`.
  Notes arrive from imports, so their links are untrusted (A2).
- R19.3 Every response carries a CSP, `frame-ancestors 'none'`,
  `X-Frame-Options`, `nosniff`, a referrer policy and a permissions policy.
  `connect-src 'self'` is the part that matters most: even a script that got
  in could not send a note to another server (A3).
- R19.4 Import never inflates more than 2 MB per entry or 50 MB per upload,
  whatever the compressed size (A4).
- R19.5 The edge gate and the route handlers apply the same 32-character
  floor to `AUTH_SECRET`, and both fail closed (A6).

Not done here: revocable sessions (A5) need a schema change, and a nonce-based
CSP needs per-request rendering. Both are listed as follow-ups in the audit.

### 4.20 App icon

The tab showed the browser's blank page icon, which makes Ursa hard to find
among a row of tabs and looks unfinished on a phone's home screen.

- R20.1 A distinctive icon: Ursa Major's Big Dipper, in the forest theme's
  brand mint on its canvas colour — the name, drawn.
- R20.2 It stays legible at 16px: few shapes, heavy strokes, no text.
- R20.3 Served as `app/icon.svg` for current browsers, `app/favicon.ico`
  (16 and 32px) for anything that asks for `/favicon.ico`, and a full-bleed
  `app/apple-icon.png` at 180px, because iOS rounds the corners itself and
  fills transparent ones with black.
- R20.4 Icons load on the sign-in page too: the edge gate must not redirect
  them to `/login`.

Not done: the icon does not follow the chosen theme or accent colour. A
favicon is cached aggressively and shown before any setting is read, so a
dynamic one would flicker between colours.

### 4.21 Spoilers

The library is mostly question banks. A notes app can store a question and its
answer but not hide it: the answer sits in plain sight the moment the note
opens. Shipped in v1.24.0 at the owner's request.

- R21.1 `||text||` hides its text until the line is being edited. Clicking the
  line reveals it; moving the caret away hides it again — the same reveal-on-
  edit bargain as every other marker, so there is no extra state to learn.
- R21.2 Hidden text is blurred, not blanked, so the shape of the answer — where
  it sits, roughly how long it is — still shows.
- R21.3 `⌘⇧E` wraps the selection in a spoiler, or unwraps it.
- R21.4 The note list never leaks a spoiler: titles and excerpts show `▒▒▒`
  in its place.
- R21.5 Spoilers do not open on a spaced `a || b`, need a closer, and stay
  literal in code, so existing notes do not suddenly hide text.

Not done: spoilers inside table cells (GFM splits cells on `|` first), and
search results still show matched text from inside a spoiler — finding a note
by its answer is useful, and search is something you do on purpose.

### 4.22 Live math

Notes are where back-of-envelope numbers live — a trip budget, a salary
comparison, a split bill — and today every one of them means switching to a
calculator and copying the answer back, after which it is stale the moment a
number above it changes.

- R22.1 A line ending in `=` shows its answer after the `=`, in the accent
  colour. The answer is drawn by the editor and **never written into the
  note**: the stored text stays what was typed, and the answer is always
  current.
- R22.2 `name = expression` defines a name for the lines below it. Names may
  contain spaces (`per person = total / 3`). A name is never used above the
  line that defines it.
- R22.3 `total =` (or `sum =`) adds up the answers and definitions above it,
  back to the last blank line or heading.
- R22.4 Written the way people write: thousands commas, `x`/`×`/`÷`, `%` and
  `18% of 240`, a currency sign carried into the answer (money shown to the
  cent), and a label before the math (`food: ₹900 * 4 =`).
- R22.5 Prose is left alone: a line that does not parse as math, a bare
  number, and anything inside a code block show nothing.
- R22.6 Clicking an answer copies it, without thousands separators.
- R22.7 Its own parser — never `eval`. The CSP forbids it, and note text
  arriving from an import must never run as code. Function lookups are own-
  property only, so `constructor(1)` reaches nothing.
- R22.8 Re-reading a 50k-character note stays well inside one frame, because
  it happens on every keystroke.

Not done: units (`5 km in miles`), dates, and currency conversion — each needs
data that changes or a much larger grammar. `x` always means multiply, so it
cannot be a name.

### 4.23 Drill mode — *removed*

Shipped in v1.14.0 (commit `f8c073f`): a note's questions asked one at a time
with a clock and self-rating, weakest first. **Removed in v1.15.2 at the
user's request** — they did not want it. Do not rebuild it, or anything
like it (flashcards, quizzes, spaced repetition), without asking first.

### 4.24 Images

Notes could hold text only. Screenshots of an error, a whiteboard photo, a
diagram from a talk — all had to live somewhere else.

- R24.1 Paste an image, drop one onto the editor, or pick one from the format
  bar. A placeholder appears at once and becomes the image when the upload
  lands; a failed upload removes the placeholder and says why.
- R24.2 The note stores ordinary markdown, `![name](/api/attachments/<id>)`,
  so the text stays the source of truth and the image reveals its markdown on
  the caret's line like every other construct.
- R24.3 Images are stored in Postgres (`Attachment`, bytea), behind the same
  password as the notes — no extra service, no public URLs. Each is scaled to
  at most 2000px on the long side and re-encoded as WebP in the browser before
  upload; GIFs are kept as-is so animation survives. The server caps uploads
  at 4 MB.
- R24.4 The server decides the type from the file's magic bytes and accepts
  only PNG, JPEG, GIF and WebP. SVG is refused: it can carry script, and
  serving it from this origin would be stored XSS. Images are served with
  `nosniff` and cached privately for good, since an attachment never changes.
- R24.5 Images linked from the web (`https:`) are drawn too; the CSP's
  `img-src` allows `https:` for that. Any other scheme stays as text.

Not done: images are not yet included in the export zip (the markdown links
are, so an export references them but does not contain them); deleting a
note does not delete its images, because one image can appear in several
notes — orphan cleanup is a later job; no resizing handles in the editor.

### 4.25 Actions that wait

Every button that called the server acted instantly in the UI and then did
nothing visible while it waited. "New note" pressed three times while a cold
server woke up made three notes; a failure was swallowed without a word.

- R25.1 Every action that waits on the network — new note, pin, trash,
  restore, delete forever, empty trash, creating a note from a link — runs
  one at a time per target. Pressing again while it runs does nothing; it is
  not queued.
- R25.2 While it runs, its button shows a spinner and is disabled; a row's
  buttons stay visible while one of them is working.
- R25.3 A note being opened dims the editor until it arrives.
- R25.4 A failure says so — what failed and the server's reason — instead of
  disappearing into the console.
- R25.5 *(v1.35.0)* Opening a note retries once after a failure; if it still
  fails the editor says "Couldn't open this note" with Try again, rather than
  silently showing the empty "Pick a note" screen. Reported as "Esc closes the
  note": Safari's Esc stops loading, which can cut off the request.

### 4.26 Phones

Ursa was built at a desk. On a phone it worked but fought you: 24–28px
buttons, desktop gutters leaving a 250px column of text on a 390px screen,
invisible-but-tappable buttons on every list row, a format bar the keyboard
covered, and a back gesture that left the app.

- R26.1 On touch screens every icon button is at least 40px, small text
  buttons at least 40px tall, and to-do checkboxes grow (keeping the same
  total width, so hanging indents still line up).
- R26.2 Below 640px the editor drops the desktop gutters: the text uses the
  screen (366 of 390px), and the Padding setting applies from tablet width up.
- R26.3 Hover-revealed row buttons (pin, trash, restore, delete) do not exist
  on screens without hover. They were invisible yet still tappable, so a tap
  near a row's corner could trash a note. The editor toolbar has the same
  actions in plain sight.
- R26.4 The format bar rides above the on-screen keyboard (visual viewport),
  and scrolls sideways with a fade at the edge when it is wider than the
  screen.
- R26.6 *(v1.23.1)* The Appearance panel is capped at the screen's available
  height and scrolls. As actions were added it outgrew a phone and even a
  720px laptop window, and everything below the fold — export, import,
  install, both sign-outs — could not be reached.
- R26.5 Opening a note on a narrow screen adds a history entry, so the system
  back gesture and Android's back button return to the list instead of
  leaving the app; the in-app back button uses the same entry so history
  stays balanced. Unsaved text is flushed on the way back.
- R26.7 *(v1.25.0)* Below 900px the editor's top bar is Back, the status
  line, Pin (or Restore) and a ⋯ menu with History, Outline and Move to
  trash. Seven 40px buttons left the status line as "Edited ju…". Focus mode
  is desktop-only (on a phone the list is already hidden); the word count
  hides below 480px.
- R26.8 *(v1.25.0)* Table columns are never narrower than 7.5rem; a table
  wider than the pane scrolls sideways inside its own frame. Before, columns
  squeezed to a word per line, and the editor content (a flex item with an
  automatic minimum width) stretched past the screen edge.
- R26.9 *(v1.25.0)* The format bar's fade follows its scroll position: right
  edge while there is more to the right, left edge once scrolled to the end.
  A fixed fade kept the last buttons faded out even when fully scrolled.
- R26.10 *(v1.25.0)* On a phone the note list carries the Appearance button,
  so What's new, export, install and sign out do not wait on opening a note.
  What's new is the first item in the panel.

### 4.27 Install as an app

On a phone, a notes app you open twenty times a day should be an icon on the
home screen, not a browser tab you hunt for.

- R27.1 Ursa is installable (Chrome reports no installability errors): a web
  app manifest with name, standalone display, theme colours and 192/512px
  icons, including a maskable one whose artwork stays inside Android's
  circular safe zone.
- R27.2 "Install as an app" in the Appearance panel and the command palette.
  Chromium browsers get their real install prompt; Safari has no install API,
  so on an iPhone it explains Share → Add to Home Screen. Hidden once
  installed.
- R27.3 iOS opens it full-screen under its own name (apple-web-app tags), and
  the shell keeps clear of the notch with safe-area padding.
- R27.4 A service worker that caches **nothing of yours** — a cached note is a
  stale note, and a stale note saved back is a lost edit. It only answers a
  failed page load with a plain "You're offline" page; API calls still fail
  loudly so autosave's retry and the error toasts see them. It is served
  uncached so a fix reaches every installed copy.
- R27.5 The manifest and service worker load without a session — browsers
  fetch them without the cookie, and a redirect to /login made the app
  silently uninstallable.

Not done: real offline editing. That needs a local copy of notes and a merge
on reconnect; §4.18's conflict copies are the safe base for it.

### 4.28 Note history

Every save replaced the last, and the editor's undo history is lost on every
note switch. A bad paste, a select-all-delete or a wrong conflict resolution
could not be taken back once you had looked at another note.

- R28.1 Earlier versions are kept in `NoteRevision` (added to production as
  a new table, rehearsed on a Neon branch first).
- R28.2 A version is kept at most once every ten minutes while you write —
  the text as it was before the session's changes — and **always** before a
  save that removes more than half of a note of 200+ characters, which is
  what a bad paste or select-all-delete looks like. Quick edits do not pile up.
- R28.3 The kept text is read under a row lock in the same transaction as the
  save, so it is exactly what was overwritten. A stale save (§4.18) keeps
  nothing, because it changed nothing.
- R28.4 History (toolbar, or the palette) lists versions newest first, previews
  one, and says what restoring it would do: "brings back N lines · drops M you
  have now", with the returning lines highlighted. Compared against the
  editor's live text, not the text as loaded.
- R28.5 Restoring keeps the current text as a version first, so a restore can
  itself be undone; unsent typing for the note is dropped, and a save already
  in flight becomes a conflicted copy rather than overwriting the restore.
- R28.6 At most 50 versions per note; the oldest go first. Deleting a note
  permanently deletes its history; trashing it does not.

### 4.29 Images in exports

v1.15 added images, but the export zip — the only backup — left them out.
Restoring a backup silently lost every image.

- R29.1 Export puts every image a note refers to in the zip once, under
  `attachments/<id>.<ext>`, byte for byte.
- R29.2 The note's links are rewritten to those relative paths, so the archive
  shows its images in Obsidian, VS Code or any markdown viewer.
- R29.3 Import stores those images again through the same checks as an upload
  (magic bytes decide the type, SVG never passes, 4 MB cap, inside the import's
  overall size budget) and points the links at the new copies. Import still
  never overwrites, so re-importing a backup duplicates rather than merges.
- R29.4 The import report counts images, and lists any that were refused.

### 4.30 Sign out, everywhere

Signing out ended nothing: a session was a signed expiry with no server-side
record, valid for 30 days, and there was not even a sign-out button. A copied
cookie — and one was pasted into a chat on 2026-10-03 — kept working, and
changing the password did not stop it (security audit A5).

- R30.1 "Sign out" and "Sign out everywhere" in the Appearance panel.
- R30.2 Every session carries the epoch it began under; "everywhere" raises
  the stored epoch, and any older session is refused on its very next request
  — API call or page load. Only a signed-in caller can do this.
- R30.3 Sessions are signed with the secret and the password together, so
  changing `APP_PASSWORD` ends every session without any other step.
- R30.4 The epoch is read from the database on every request, not cached: a
  per-instance cache was tried and, because Next bundles routes separately,
  let old sessions in and issued new ones under the old epoch for seconds
  after a sign-out.
- R30.5 The epoch never leaves the server; appearance settings sent to the
  page exclude it.

Shipping this ends every existing session once (old tokens lack the epoch and
were signed with the old key) — the owner signs in again, and the exposed
cookie dies with the rest.

### 4.31 Share to Ursa, and home-screen shortcuts

On a phone, things worth keeping turn up in other apps — a link in Chrome, a
paragraph in an article, a question in a message. Getting one into Ursa meant
copy, switch apps, new note, paste.

- R31.1 The installed app is a share target: it appears in the system share
  sheet, and a share opens a "Save to Ursa" preview.
- R31.2 The preview turns the share's loose title/text/url into a tidy note —
  a heading, the text, the link once (Chrome on Android puts the link inside
  the text; it is pulled out, not repeated). It is editable before saving.
- R31.3 **Nothing is saved on arrival.** A share arrives as a GET, and a GET
  that wrote a note would let any website plant notes by linking to it — the
  session cookie travels with a top-level link. Saving takes one tap.
- R31.4 A share made while signed out survives the sign-in: the edge gate's
  `next` now keeps the query string, not just the path.
- R31.5 Long-pressing the home-screen icon offers "New note" and "Search
  notes". Their intents (`?new=1`, `?search=1`, and a saved share's
  `?open=<id>`) are read once and removed from the address bar, so a reload
  does not make a second note.

### 4.32 Errors that leave a trace, and a health check

Every client-side failure was caught silently or not at all. A production
problem produced no signal anywhere, so the first anyone knew was a note that
did not save.

- R32.1 Uncaught errors, unhandled rejections, failed actions (§4.25),
  failed saves and crashed screens are reported to `/api/log`, which writes
  one JSON line per report to the server log, where the host keeps it.
- R32.2 Reports are bounded (message 500 chars, stack 4 KB) and carry the
  path **without its query** — a share's text (§4.31) must never reach a log.
- R32.3 Each distinct failure is reported once a minute per page, so a save
  retrying with backoff or an error thrown every render makes one report;
  the endpoint also caps reports per instance, and only accepts signed-in
  callers.
- R32.4 A screen that crashes while rendering shows "Something went wrong",
  with Try again and Reload, instead of a blank page.
- R32.5 `/api/health` (public) answers `{ ok, db, version }` — 200 when the
  database answers, 503 when it does not — for uptime monitors. It says
  nothing about notes.

Not done: alerting. Vercel keeps the logs; a monitor pointed at /api/health
or a log drain is the user's choice of service.

### 4.33 A login limit that holds

Failed sign-ins were counted in server memory, which every new serverless
instance starts empty — a guesser got a fresh allowance on each cold start
(security audit A7).

- R33.1 Failures are stored in `LoginFailure` (a new table) and counted per
  client address over a sliding 10-minute window; at 10, further attempts get
  429, even with the right password, until the window passes.
- R33.2 The count is shared by every instance and survives restarts.
- R33.3 A successful sign-in clears that address's failures; rows older than a
  day are pruned as new failures are written.
- R33.4 The address comes from the platform's x-forwarded-for (set by Vercel,
  not the client), validated before it is stored; without one, attempts share
  a single bucket, which errs towards limiting.

Not done: a global limit across addresses. It would stop a distributed
guesser but would also let anyone lock the owner out; a long random password
is the better defence.

### 4.34 A CSP without 'unsafe-inline' for scripts

Since v1.11.2 the CSP fenced scripts in (`connect-src 'self'`) but did not
stop an injected inline script from running: Next's own inline bootstrap
needed `'unsafe-inline'` (audit A3).

- R34.1 Every request gets a fresh 128-bit nonce. proxy.ts builds the policy
  (`lib/security/csp.ts`) and passes it to Next, which stamps the nonce on
  its own scripts; the theme bootstrap carries it explicitly.
- R34.2 `script-src 'self' 'nonce-…' 'strict-dynamic'`: no `'unsafe-inline'`,
  no `'unsafe-eval'` in production. Injected markup — an `onerror`, an inline
  `<script>` in HTML — does not run.
- R34.3 Every other directive is unchanged (`connect-src 'self'`,
  `frame-ancestors 'none'`, `object-src 'none'`, images from https), plus
  `worker-src` and `manifest-src 'self'` for the installed app.
- R34.4 Styles keep `'unsafe-inline'`: CodeMirror injects style elements and
  the editor sets style attributes, which nonces cannot cover, and a style
  cannot run code.

### 4.35 Clean up unused images

Deleting a note leaves its images stored, because an image may appear in
several notes (§4.24). On a 512 MB database they would eventually crowd out
the notes.

- R35.1 The Appearance panel shows "Clean up N unused images (size)" when
  there are any, and nothing when there are none.
- R35.2 An image is in use if any note — trashed ones included — or any kept
  version (§4.28) refers to it, so restoring an old version never brings back
  a broken image.
- R35.3 Images uploaded in the last hour are never counted: one being pasted
  is uploaded before its note is saved.
- R35.4 It runs only when the owner presses it, after a confirmation that
  states the count and size, and works out the set again inside the delete's
  transaction rather than trusting the count shown.

### 4.36 Accessible to read and to operate

An axe audit (WCAG 2 A/AA) of the sign-in page, list, editor and Appearance
panel found: faint text — timestamps, excerpts, the editor's status line — at
2.2–3.4:1 contrast in every theme; the editor's editable surface with no
accessible name; and the two sliders unnamed, because their label sat on the
root while the range input lives in the thumb.

- R36.1 `--ink-soft` and `--ink-faint` reach at least 4.5:1 on the canvas, list,
  raised surfaces and the selected row, in all five themes. Each grey was moved
  the least distance towards `--ink` that reaches it, and `--ink-soft` was
  raised to at least 6:1 so it stays a visible step above `--ink-faint`.
- R36.2 A test reads `app/globals.css` and fails if any theme drops below
  4.5:1, so a future palette edit cannot quietly undo this.
- R36.3 The editor is announced as "Note text"; the sliders as "Corner radius"
  and "Editor text size".
- R36.4 axe reports no violations on any of the four screens.

## 5. Success criteria

| Criterion | Measure |
|---|---|
| Editor latency | Keystroke → painted glyph under 16ms at p95 in a 50k-char note |
| Fenced highlighting | A ```json block resolves distinct property / string / number tokens |
| No data loss | Kill the tab mid-sentence; at most the last 400ms of typing is gone |
| Cold start | `docker compose up` → `pnpm dev` → usable app in under 2 minutes |
| Keyboard completeness | Create, find, edit and delete a note without the mouse |

## 6. Risks

| Risk | Mitigation |
|---|---|
| Single-pane editing is the hard part and it's load-bearing | Built on CodeMirror 6 + Lezer decorations rather than a bespoke contenteditable |
| A hand-rolled markdown parser can't highlight nested languages | v1.1 replaced it with Lezer's markdown parser, which supports nested language parsing. This was the reason for the rewrite |
| Autosave races when switching notes fast | Saves keyed by note id with a per-note in-flight guard; a switch flushes before unmount |
| Theme tokens drift between light and dark | Every theme defines the same token set in one file; components reference tokens only |

## 7. Deferred, with the hook that keeps it cheap

- **Auth / multi-user** — no table carries a user column, but all queries route
  through `lib/db/notes.ts`. Adding `userId` is a migration plus a `where` clause
  in one file.
- **Sync** — notes carry `updatedAt` and a soft-delete `deletedAt` from day one,
  the minimum a last-write-wins sync needs. No schema change required.
- **Wiki-links** — the editor's parser takes Lezer `MarkdownConfig` extensions;
  `[[…]]` is one more inline parser alongside the three in `bearMarkup.ts`.
- **Export** — notes are stored as raw markdown, not as a parsed AST. Export is a
  serialisation of what is already in the column.
- **Import from Bear** — Bear stores notes as raw markdown in `ZSFNOTE.ZTEXT`.
  Because Ursa stores raw markdown too, import is a read and an insert.
- **Full-text search** — search is currently `ILIKE` over the body. Postgres
  `tsvector` drops in behind the same `listNotes` signature when that stops
  scaling.

## 8. Open questions

- Should search rank results, or is "most recently edited that matches" enough?
- Trash is never auto-emptied. Should it expire at 30 days like Bear's?
- `/italic/` and `::highlight::` are Bear-isms that cost parser complexity. Worth
  keeping, or should they become a flag?

### 4.37 Named myNotes

The owner renamed the app from Ursa (v1.25.0). Every user-visible name —
page title, installed-app name, share sheet entry, sign-in page, offline page,
install prompts, export file name (`mynotes-<date>.zip`) — says myNotes. The
icon is a page of notes with a folded corner in the forest theme's colours,
replacing the Big Dipper, which said nothing about notes. Internal names
(`ursa-*` CSS classes, the database, the package) are unchanged: renaming
them would churn every file for nothing a user sees. An installed copy picks
up the new icon when the browser next refreshes its manifest; on an iPhone,
remove and re-add it to the home screen.

### 4.38 A clearer list, aligned headings

A design pass after the rename, prompted by the owner's "enhance the UI" and a
screenshot of a heading sitting right of its paragraph.

- R38.1 The note list is grouped under small sticky headers — Pinned, Today,
  Yesterday, Previous 7 days, Previous 30 days, then month names this year and
  years before — by local calendar day, as Apple Notes and Bear do. Not over
  search results, whose order is about the match.
- R38.2 Previews read as prose: a table row shows its cells joined with " · "
  instead of pipes, divider rows are skipped, and an image shows its alt text
  (or "Image"). Stored excerpts are tidied on display too, so older notes look
  right without being re-saved; a spoiler in a table cell stays masked.
- R38.3 On a phone, New note is a floating button at the bottom right, within
  a thumb's reach; the header's New note icon gives way to it (it stays in
  the trash view, where the floating button is hidden). The list pads its end
  so the button never covers the last note.
- R38.4 Headings start exactly where paragraph text does. Hiding an opening
  `##` left its trailing space behind, set at the heading's larger size, so
  every heading sat a few pixels right; the space is now hidden with the mark.
- R38.5 The sign-in page and the empty editor show the app's mark, drawn in
  theme colours; the empty editor offers a New note button above the
  shortcuts.
- R38.6 Dates in the list render identically on the server and in the
  browser. The list is server-rendered in UTC and was hydrated in the
  owner's timezone and locale, so "Today"/"Yesterday", "3 Oct" vs "Oct 3",
  and a "17m ago" that ticked over between the two renders disagreed — React
  then throws away the server HTML and renders the page again (reproduced as
  error #418 in an Asia/Kolkata browser). The browser now stores its
  timezone and locale in a cookie (`ursa-clock`, validated by Intl on read);
  the server renders with them (UTC/en-US before the first visit sets it)
  and its render time, and the browser hydrates with exactly that before
  switching to its live clock, which ticks every 30 seconds.

### 4.39 Named mdNotes, at www.mdnotes.in

Renamed again by the owner (v1.27.0), to match the domain they own. Every
user-visible "myNotes" from §4.37 now reads "mdNotes", and exports are named
`mdnotes-<date>.zip`; the icon is unchanged. The domain is attached in Vercel
and DNS, not in code — steps in DEPLOYMENT.md §9.

### 4.40 Note actions

Getting a note out of the app, or starting one from another, meant export
(desktop-centric, a file) or select-all and copy (fiddly on a phone).

- R40.1 **Duplicate** makes a new note with the same text and opens it; an
  opening heading gets "(copy)" so the two differ in the list (never stacked
  — a copy of a copy stays "(copy)"). It copies the editor's live text, not
  the last saved body, and is gated like every network action (§4.25).
- R40.2 **Copy as Markdown** puts the note's text on the clipboard.
  **Share…** opens the system share sheet with the title and text, where the
  browser has one (phones, Safari); closing the sheet is not an error, and a
  failed share falls back to copying. **Download .md** is the existing
  single-note export, now in the menu.
- R40.3 Tapping a `#tag` searches for it — on any line not being edited, so
  editing a tag still works. Consistent with §2: tags file nothing, and search
  is how notes are found. `##work` searches `#work`; `#multi word#` searches
  `#multi word`.
- R40.4 On a phone these live in the ⋯ menu with History, Outline and Trash;
  on a desktop a ⋯ menu sits next to Trash. Duplicate and Copy are also in the
  command palette.

### 4.41 The `/` menu

On a phone there is no ⌘B, and the format bar holds a dozen controls at most.
Typing `/` at the start of a line opens a list of blocks — the Notion and
Bear habit.

- R41.1 Opens on `/` as the first thing on a line (indentation allowed), never
  mid-line, so paths (`a/b`, `/usr`) and URLs are untouched; never in code.
- R41.2 Typing narrows it — every word typed must start a word of an item's
  label or keywords (`/check` → To-do, `/hr` → Divider, `/link to` → Link to
  note), label matches first; no match, or a space straight after `/`,
  closes it. Arrow keys and Enter,
  or a tap, choose; Escape dismisses.
- R41.3 Items: Heading 1–3, To-do, Bulleted list, Numbered list, Quote, Code
  block, Table, Divider, Spoiler, Link, Link to note, Image (opens the picker,
  then uploads as in §4.24). Each replaces the `/query` with the same markdown
  the keyboard would write and puts the caret where typing continues.
- R41.4 Larger targets on touch screens; themed like the rest of the app.

Built on CodeMirror's autocomplete (already installed with the markdown
language; now a direct dependency).

### 4.42 Up to date when you come back

The installed phone app stays in the background for hours and a laptop tab for
days. Coming back showed the list and the open note as they were — so the
first keystroke on a note changed elsewhere became a conflicted copy (§4.18).

- R42.1 When the app becomes visible after at least 10 seconds away, or the
  connection returns, the list is refetched and the open note is checked.
- R42.2 The open note takes the server's text only if this client holds
  nothing unsaved and the server's version is newer than the one this
  client's text was built on — checked again after the fetch, since typing
  may have started meanwhile. Unsaved text always wins; a stale save of it
  still becomes a conflicted copy, as before.
- R42.3 If the text changed, a toast says it was updated from another device.
  An unchanged note is not touched, so the caret and scroll stay put.

### 4.43 Search lands on the match

Search found the note, then dropped you at its top: in a long question bank
the word you searched for could be three screens down.

- R43.1 While a search is active, every occurrence of its words in the open
  note is marked, folding case and accents exactly as search does (`cafe`
  marks "Café").
- R43.2 Opening a note from a search selects the first hit and scrolls it to
  the middle of the screen.
- R43.3 Changing the search re-marks the open note without moving the caret;
  clearing it removes the marks. Marks follow edits.
- R43.4 Positions are computed on text folded one character at a time, so an
  emoji or a character that folds to two letters never shifts a mark. At most
  500 hits are marked.

### 4.44 Fold a section

Question banks run to hundreds of lines, one heading per company or topic.
Reading one section meant scrolling past all the others.

- R44.1 Every heading that has text under it gets a small chevron after its
  text. Tapping it collapses everything up to the next heading of the same or
  a higher level; the heading then ends in a "…" chip that expands it again.
- R44.2 The chevron is quiet until the heading is hovered on a desktop, always
  faintly visible on touch screens (where nothing hovers), shown fully on a
  folded heading, and never moves the heading text (§4.38's alignment).
- R44.3 Folding never edits the note and keeps the caret where it was.
  Keyboard: ⌘⌥[ / ⌘⌥] fold and unfold at the caret (Ctrl+Shift+[ / ] off
  macOS); Ctrl+Alt+[ / ] fold and unfold all.
- R44.4 Folds belong to the open view: switching notes or reloading shows the
  note unfolded.

### 4.45 `[[` suggests note titles

A wiki-link (§4.10) works only when its text matches a title, and titles are
easy to misremember — "Google onsite" or "Google on-site"?

- R45.1 Typing `[[` lists note titles; typing more narrows them, prefix
  matches first, then matches anywhere in the title, ignoring case and
  accents. Trashed notes, and the note being edited, are not offered.
- R45.2 Choosing one writes the exact title and closes the link (`]]`),
  reusing a `]]` already there rather than doubling it, and leaves the caret
  after the link.
- R45.3 The `/` menu's "Link to note" goes straight on to the title list.
- R45.4 Titles are fetched once and kept for 30 seconds, independent of any
  search filtering the list on screen.

### 4.46 Security headers and cross-site writes

The owner asked whether every security header is set. Most were; the review
and its fixes are in SECURITY-AUDIT.md A9–A11.

- R46.1 Every response: CSP (per-request nonce), HSTS (2 years, subdomains),
  X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy,
  Cross-Origin-Opener-Policy and Cross-Origin-Resource-Policy `same-origin`;
  no `X-Powered-By`.
- R46.2 CORS stays closed: no `Access-Control-Allow-*` header is ever sent.
- R46.3 A write (POST/PATCH/DELETE) the browser marks cross-site or
  same-site, or whose Origin is another host, is refused with 403 before any
  handler runs — every guarded route, plus sign-in and sign-out.
- R46.4 Signed-in responses are `Cache-Control: no-store` unless the route
  chose otherwise (images: private, immutable).

### 4.47 Copy as HTML

Notes end up in emails, docs and chat. Copy as Markdown gives `**` and `#` to
anyone who pastes it into Gmail.

- R47.1 "Copy as HTML" in the ⋯ menu and the palette puts the note on the
  clipboard twice: as HTML (rich editors keep headings, bold, lists,
  to-dos as ☐/☑, links, tables, code blocks, images) and as the HTML source in
  plain text (a code editor or CMS gets the markup).
- R47.2 Rendered from the editor's own Lezer parse. All note text is escaped;
  raw HTML in a note is copied as text, never markup; links keep only
  http(s)/mailto; app images get absolute URLs. Spoilers, wiki-links and tags
  are copied as their text.

*Also in v1.35.0 —* R2.11: a fenced code block's box now starts on the text
column, aligned with headings and paragraphs, with its code indented inside;
it used to fill the line's gutter padding and stick out to the left.

### 4.48 Motion and illustrations

Owner feedback: "no rich images, no animations, no transitions". The app
changed state by snapping: a note replaced the last in one frame, a phone
jumped between list and note, empty states were a line of grey text.

- R48.1 Opening a different note glides it in (220ms fade and rise).
- R48.2 On a phone the note slides in from the right and the list back from
  the left (280ms), each pane animating as it is shown.
- R48.3 List rows rise in when they first appear, lightly staggered; rows and
  the floating New note button respond to a press; the button springs in.
- R48.4 Ticking a to-do pops its box.
- R48.5 Empty states — no notes, empty trash, no search matches, no note
  open — have a small illustration in theme colours, floating gently with
  twinkling sparkles, plus a title, a hint and (where it helps) a New note
  button.
- R48.6 All motion is short and eased, and none of it plays for anyone with
  reduced motion turned on in their system settings.

### 4.49 Emoji

Owner feedback asked for something richer than text — stickers, images.
Emoji are the stickers a markdown note can hold: plain characters, so they
save, search, export and sync like any other text.

- R49.1 Typing `:` then two or more letters after a space or at the start of
  a line suggests emoji by shortcode and keyword (`:fire` 🔥, `:done` ✅);
  choosing one replaces the code. Times (`10:30`), URLs, `::highlight::` and
  `:)` never trigger it.
- R49.2 A smiley button in the format bar opens a grouped, scrollable grid —
  Smileys, Gestures, Marks, Work, Life — that inserts at the caret and keeps
  the keyboard's place.
- R49.3 The picker lists colour emoji fonts first, so a system whose text
  font also has the glyph does not draw a monochrome outline. The app's text
  font stacks are left alone: Noto Color Emoji also holds digit and `#`
  glyphs, and on Android it would then draw plain numbers.
- R49.4 A curated ~250 emoji, not the full 3,700: the ones notes use, a small
  bundle, unique shortcodes (tested).

### 4.50 Tap an image to see it

A screenshot in a note is shown at the column's width — on a phone, too small
to read — and tapping it revealed its markdown instead of the picture.

- R50.1 Tapping an image opens a full-screen viewer: dark backdrop, the
  image as large as fits, its alt text as a caption. It fades and scales in.
- R50.2 Tapping the image toggles a zoomed view at its natural size, which
  scrolls; ✕, Esc or a tap outside closes the viewer. Esc is the viewer's
  alone — it never also reaches the editor.
- R50.3 "Edit" closes the viewer and puts the caret on the image's line,
  revealing its markdown — the old tap behaviour, one step away. "Open"
  opens the original in a new tab. Broken images do not open the viewer.

### 4.51 Image thumbnails in the list

A note built around a screenshot or a whiteboard photo looked like every other
row in the list.

- R51.1 A note's first image — an uploaded one or an https one, never one
  inside a code block — shows as a small rounded thumbnail at the right of its
  row. It loads lazily, and one that fails to load is simply not shown.
- R51.2 It is stored as `Note.cover`, derived on every write by the single
  body writer like title and excerpt, so it cannot drift from the text.
- R51.3 Production change (2026-10-04): `ALTER TABLE "Note" ADD COLUMN
  "cover" TEXT` plus a backfill computing it with an SQL regex equivalent to
  `deriveCover` (checked against the JS on all 72 preview notes). Rehearsed on
  a Neon branch; before and after, every note's body checksum, `updatedAt`
  and version were identical — only the new column was written.
