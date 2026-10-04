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

- **Tags as organisation.** Cut in v1.1; partly back in v1.53 at the owner's
  request (§4.66): a tag tree that searches. Still no tag table — tags are
  derived from note text on read — and no rename.
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

The tab icon now follows the theme and accent — see §4.60. The home-screen
icon of an installed app cannot: the operating system copies it at install.

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

### 4.52 Swipe a row for actions

Owner request: "swiping right to left on notes should give me options — three
dots and delete — like on iPhone". On a phone the only way to act on a note
was to open it first (hover buttons do not exist on touch, §4.26).

- R52.1 On touch screens, swiping a list row right-to-left slides it to
  reveal **More** (grey) and **Delete** (red); in Trash, **Restore** and
  **Delete** (forever). The row follows the finger, resists past the
  buttons, and settles open past half their width or on a flick.
- R52.2 Swiping most of the way across (or a hard flick past the buttons)
  moves the note to Trash straight away, as iOS Mail does — with the usual
  Undo. Deleting forever is never a full swipe and always asks first.
- R52.3 More opens Pin/Unpin, Share… (where there is a share sheet), Copy as
  Markdown and Duplicate — for any row, not only the open note: the open note
  uses the editor's live text, others are fetched. Copy starts its clipboard
  write inside the tap (Safari requires it) with the text still loading.
- R52.4 One row open at a time; tapping an open row closes it rather than
  opening the note; a swipe never counts as a tap. Vertical drags scroll the
  list as before. A mouse never swipes; desktop keeps its hover buttons.
- R52.5 Also in this release: the empty-state illustrations are centred on
  their halo (each drawing's bounding box was measured and offset).

### 4.53 To-do progress in the list

Checklists — a prep plan, a packing list — said nothing in the list about how
far along they were.

- R53.1 A note with to-dos shows a chip after its date: a small progress ring
  and "done/total". Fully ticked, it turns the accent colour.
- R53.2 Counts are `Note.todoDone` / `Note.todoTotal`, derived on every write
  by the single body writer (`- [ ]`, `* [x]`, `+ [X]`, any indentation; never
  inside code blocks).
- R53.3 Production change (2026-10-04): two `INTEGER NOT NULL DEFAULT 0`
  columns plus a backfill with `regexp_count` (Postgres 18), matching the JS
  on all 75 preview notes; no production note mixes code blocks and to-dos,
  so the SQL equals the JS there exactly. Rehearsed on a Neon branch; every
  note's body md5, `updatedAt` and version identical before and after.

### 4.54 Templates and image captions

- R54.1 The `/` menu offers four templates: **Daily note** (today's date as
  the heading, a top-three to-do list, notes), **Meeting notes** (topic
  selected for typing, date, attendees, agenda, notes, action items),
  **Interview prep** (company selected, role, recruiter, a rounds table,
  questions to ask them, follow-ups) and **Checklist**. `/template` lists
  them all. They are plain markdown — nothing is tracked or scored.
- R54.2 An image's alt text shows as a small italic caption under it — but
  only words someone wrote: filenames, camera names (`IMG_2041`), generic
  words ("image", "screenshot") and upload placeholders are not shown.

### 4.55 Writing offline never loses text

Autosave retried a failed save, but only while the tab lived: on a phone the
browser may close a background tab or kill the installed app, and anything
typed without a connection went with it (the unload keepalive fails offline
too).

- R55.1 Every edit is also written to a device outbox (localStorage, which is
  synchronous, so a closing tab cannot interrupt the write) with the note
  version it was built on. It is removed when the server confirms that exact
  text — in the note, or kept as its conflicted copy.
- R55.2 On launch, each outbox entry is checked against the server: text the
  server already has is dropped (no duplicate when a save landed but its
  reply did not); a note deleted meanwhile is recreated with the text;
  anything else goes back through autosave with its original base version,
  so a clash with edits from another device becomes a conflicted copy
  (§4.18), never an overwrite. A replayed note already on screen switches to
  the device text first. A toast says how many notes were synced.
- R55.3 While the browser reports no connection, a failed save shows
  "Offline — kept on this device, will sync" instead of an error, and saving
  resumes the moment the connection returns rather than after the backoff.
- R55.4 Text moved to a conflicted copy takes its device copy with it.
- R55.5 Storage that is full or blocked (private mode) silently falls back to
  the in-memory autosave; typing never fails because of it.
- R55.6 While the browser reports no connection, autosave does not send
  requests that cannot land; it waits for "online". A save started as a page
  closed can still be delivered when the network returns, ahead of the next
  launch's replay — then the replay finds the text already saved and drops it,
  and whichever of two clashing saves lands second becomes the conflicted
  copy. Verified as an invariant, not an order: both texts always survive,
  with exactly one conflicted copy and no duplicates.

Opening the app with no connection at all: see §4.56.

### 4.56 Open the app offline

The installed app showed "You're offline" whenever there was no connection,
even for notes read a minute earlier. §4.27 kept nothing on purpose — a
cached note is a stale note — but with the outbox (§4.55) a stale copy can no
longer overwrite anything, so the rule becomes: never *prefer* a copy.

- R56.1 Network first, always. The page, the full note list, and each note
  are fetched from the server whenever it answers; a copy is used only when
  the request fails outright. Searches, settings, writes and auth are never
  served from a copy.
- R56.2 Copies are kept of: the signed-in page `/` (only a real 200 HTML
  answer, never a redirect to sign-in), the full list, notes opened, and
  images viewed (immutable, so cache-first). The build's hashed files are
  cache-first; when the page is cached, every `/_next/static` file it
  references is fetched into the cache too, so an offline reload works even
  right after the service worker was first installed. Old build files are
  trimmed beyond 400.
- R56.3 The page is cached together with its own CSP header, so its nonce
  and its scripts stay a matching pair; nothing else reuses that nonce.
- R56.4 Copies are deleted on sign-out and whenever the sign-in page loads —
  which also covers a session ended from another device or expired — so
  notes do not remain on a device that is no longer signed in.
- R56.5 While offline, a banner says the app is showing what this device last
  saw and that edits will sync. Editing an offline copy uses the outbox with
  the copy's version, so a clash becomes a conflicted copy.

Trade-off, stated plainly: notes you opened are stored on the device (the
browser's Cache Storage) until you sign out. On a shared computer, sign out.

### 4.57 Jump back

Going back to the note you were just in meant finding it in the list again.

- R57.1 ⌘K opens with a **Recent** group first: the last six notes opened,
  newest first, without the one open now — so ⌘K then Enter returns to the
  previous note, and pressing it again swaps back.
- R57.2 Kept on the device (last ten), filtered to notes that still exist in
  the list; typing in the palette filters them like everything else.
- R57.3 The palette's note excerpts are tidied like the list's (§4.38).

### 4.58 Reading mode

On a phone, opening a note to read it put a caret in it, and any tap risked
the keyboard; the format bar sat over the end of the text.

- R58.1 "Reading mode" (⋯ menu, palette) opens notes read-only: no caret, no
  keyboard, no format bar. A "Reading · tap to edit" pill switches back. The
  choice is remembered on the device.
- R58.2 To-dos can still be ticked in reading mode; that is a save like any
  other.
- R58.3 With nothing to edit, a plain tap opens a link (⌘/Ctrl-click is
  still needed while editing). Applies to notes in the trash too.
- R58.4 Read-only switches in place (a CodeMirror compartment), never by
  rebuilding the editor from the last loaded text — which would have shown
  older text than had just been typed.

### 4.59 Hide titles for screen sharing

Owner request: blur the note list when sharing a screen.

- R59.1 An eye button in the list header, the palette, or ⌘⇧L blurs note
  titles, previews and thumbnails in the list, the palette's Recent and Notes
  groups, the backlinks strip and the `[[` title suggestions. The open note
  stays readable; rows still work when clicked.
- R59.2 No hover reveal: a cursor passing over a row on a shared screen
  would give it away. A slim "Titles hidden for screen sharing · Show" bar
  sits under the list header — not over the rows, which stay clickable.
- R59.3 One attribute on `<html>`, so anything marked private blurs wherever
  it renders, including portals.
- R59.4 It persists on the device and is applied by the early bootstrap
  script, so a reload mid-call never shows the list for a frame; the app does
  not touch the attribute until its saved settings are back.
- R59.5 Found while testing this: every device-only setting (pane width,
  focus mode, outline, and now reading mode and hidden titles) was reset on
  reload. Child components' effects run before Shell's rehydrate, any store
  update then saved the defaults, and the rehydrate read them back. The store
  now writes nothing to localStorage until it has read the saved state.

### 4.60 Tab icon follows the theme

Owner question: can changing the theme recolour the favicon?

- R60.1 The tab icon is the same page-with-a-fold, drawn in the current
  theme: canvas tile, page in the brand colour or chosen accent, fold a shade
  darker, lines cut back out in canvas.
- R60.2 No flicker: signed in, the server renders the themed icon into
  `<head>` from the saved settings, so the first paint already has it. The
  client swaps it live when the theme or accent changes, and not before its
  saved settings are back.
- R60.3 "System" ships both palettes in one SVG and lets the icon's own
  `prefers-color-scheme` query pick, so it follows the OS without script.
- R60.4 The accent is only used if it is a hex colour; anything else falls
  back to the theme's brand, so a stored value can never inject markup.
- R60.5 Not possible: the installed app's home-screen icon comes from the
  manifest and is copied by the OS at install, so it stays the forest icon.
  The static `/icon.svg`, `/favicon.ico` and apple icon are unchanged for the
  sign-in page and crawlers.

### 4.61 Polish from the owner's bug list

- R61.1 A row's hover Pin and Trash buttons sat over the title. They now sit
  on the bottom line beside the time, left of a row's thumbnail if it has one.
- R61.2 Everything clickable shows the pointer cursor. Tailwind 4 removed it
  from buttons; a base-layer rule restores it for buttons, menu items,
  options, palette items, checkboxes, radios and sliders.
- R61.3 The toolbar's palette icon opened far more than colours (What's new,
  width, export, sign out). It is now a settings icon labelled "Settings".
- R61.4 On a phone, the + button sat under a sticky section header ("Yesterday")
  as the list scrolled. It now stays above.
- R61.5 Tab in the editor types a tab instead of moving focus to the next
  button. On a list line it nests the item; with several lines selected it
  indents them; Shift-Tab outdents. In a code block it is always a tab.
  Ctrl-M (Shift-Alt-M on a Mac) switches Tab back to moving focus, for
  keyboard users leaving the editor.
- R61.7 *(v1.56.0)* Settings showed no visible choice: the shared toggle's
  pressed fill was a grey barely different from its neighbours. The chosen
  option is now tinted and outlined in the accent with bold text; the chosen
  accent swatch gets a ring in the text colour, which reads on any accent.
- R61.6 Esc was re-checked in a browser: it closes the settings panel, ⌘K, menus
  and the image viewer, and leaves the open note alone.

### 4.62 Hide titles when the app goes to the background

Owner request: switch to the blurred list automatically when the browser goes
to the background.

- R62.1 When the page becomes hidden (another tab, another app, a minimised
  window, a locked phone), hidden titles (§4.59) turn on.
- R62.2 They stay hidden on return, until Show, the eye button or ⌘⇧L —
  coming back in the middle of a screen share is exactly the moment to be
  safe.
- R62.3 The attribute on `<html>` is set in the event handler itself, not
  after a re-render, so the phone's app-switcher snapshot is already blurred.
- R62.4 On by default; Settings → "Hide titles when I leave the tab" and a ⌘K
  command switch it off. Device-only, like hidden titles.
- R62.5 Only page visibility counts, not window focus: a file picker or a
  confirm dialog takes focus, and blurring the list for those would be noise.
- R62.6 Nothing happens before the saved settings are back, so an early
  background switch can't save defaults over them (R59.5).

### 4.63 Callouts and link titles

Owner picks 3 and 4 from the roadmap page.

Callout boxes:

- R63.1 A quote whose first line starts `> [!type]` renders as a tinted box
  with a coloured bar, an icon and a title: the text after the marker, or the
  type's name. Kinds: note, tip, important, warning, caution, success,
  question; Obsidian spellings (info, danger, faq…) map onto them.
- R63.2 The marker shows as typed while the caret is on that line, like every
  other markdown mark.
- R63.3 The slash menu inserts tip, warning and note callouts.
- R63.4 Copy as HTML turns a callout into a box with inline styles, so it
  survives being pasted into mail.

Link titles:

- R63.5 Pasting a bare web link on its own inserts it at once, then replaces it
  with `[Page title](url)` when the title arrives. One undo gives the bare
  URL back.
- R63.6 Square brackets in a title become parentheses (escaped ones would show their backslashes). The swap happens only if the pasted text is still there unchanged;
  editing or deleting it cancels. Never inside code, or where a link target
  is being typed (`](` or `<`). Pasting over selected text still makes the
  selection the link text, as before.
- R63.7 The title is fetched by the server (`/api/link-title`, signed in only),
  which guards against server-side request forgery: http(s) on default ports,
  no credentials in the URL, every resolved address checked against private,
  loopback, link-local, carrier NAT, metadata and multicast ranges,
  redirects followed by hand and re-checked (at most 3), 4-second timeout,
  256KB read cap, HTML only. Only the title is returned. og:title is
  preferred over `<title>`.

### 4.64 Diagrams, PDF export, more typefaces, focus dimming

Owner picks 6, 22, 24 and 25.

- R64.1 Diagrams: a ```mermaid block draws as a diagram while the caret is
  outside it; clicking it shows the source, like tables. Mermaid loads only
  when a note has a diagram. Strict security level, so labels cannot carry
  HTML or click handlers. A mistake shows Mermaid's message instead of a
  blank. The / menu inserts a starter flowchart. Copy as HTML and PDF keep
  the source as a code block.
- R64.2 Export as PDF, in a note's ⋯ menu and ⌘K: the note is rendered with
  the Copy as HTML renderer into a print-only container and the browser's
  print dialog opens, where every platform can save a PDF. Book-like face,
  white page, code and tables kept whole across pages, callouts keep their
  colour. The file is named after the note.
- R64.3 Typefaces: Literata (book serif), Atkinson Hyperlegible (made for
  legibility), Nunito (rounded) and IBM Plex Mono join Sans, Serif and Mono.
  Self-hosted from npm (fontsource), so the CSP's `font-src 'self'` and
  offline use hold; a face downloads only once it is used. Synced between
  devices like the other appearance settings.
- R64.4 Focus dimming: with it on, every paragraph but the caret's fades
  while the editor has focus. A paragraph is the run of non-blank lines, so a
  list reads as one thought. Off by default; Settings and ⌘K switch it.
  Device-only.

### 4.65 Archive, colour labels, templates, daily note

Owner picks 7, 9, 12 and 26. Three additive columns on Note: `archivedAt`,
`color`, `isTemplate` (rehearsed on a Neon branch, fingerprint unchanged).

- R65.1 Archive: a note's ⋯ menu, the swipe menu and ⌘K archive it. It
  leaves Notes and Pinned and lists under Archive, where it can be searched
  and opened; a banner on it offers "Move back to Notes". Undo in the toast.
- R65.2 Colour labels: seven fixed colours (not a free picker, so they stay
  tellable apart and filterable). Set from a row of dots in the ⋯ menu or ⌘K;
  a dot shows before the title in the list. The list's filter menu has a
  colour row that narrows whichever list is shown; its dot appears beside the
  list name while on. The colour filter resets on reload.
- R65.3 Templates: "Save as template" moves a note to Templates, out of the
  main list. A template shows a banner with "New note from this"; ⌘K lists
  "New from template: …" for each. Placeholders {{date}}, {{weekday}},
  {{time}} and {{today}} are filled when a note is made from it; others stay.
- R65.4 Daily note: the calendar button in the list header and ⌘K "Open
  today's note" open the note titled with today's date in the device's time
  zone ("Sunday, 4 October 2026"), creating it if there is none (archived
  ones count, so archiving yesterday's never makes a duplicate). If a
  template is titled "Daily note", its text goes under the date.
- R65.5 Labels bump the edit time, as pinning always has, so other devices'
  resync picks them up. They are not part of the markdown, so exports and
  history do not carry them.
- R65.6 An older offline copy of the list, cached before these fields,
  reads as unlabelled rather than archived.

### 4.66 Tag tree and selecting several notes

Owner picks 8 and 11.

- R66.1 Tag tree: the # button in the list header lists every tag, nested
  by slash (`#work/meetings` under `work`), with how many notes carry it or
  anything below it (a note counts once per branch). Picking one searches for
  it, which also finds the nested tags. Read with the editor's own parser on
  the server, so `#` in code, headings and URLs is not a tag; case is folded.
  Derived from live and archived notes on each open; no table. The tree is
  blurred with hidden titles.
- R66.2 Selecting: long-press a row on a phone (a short buzz on Android),
  ⌘/Ctrl- or Shift-click on a computer, or "Select notes…" in the list menu.
  Rows show check circles; tapping toggles; swiping is off meanwhile. A bar
  where the + button sits shows the count, All, Cancel, and Pin/Unpin,
  Archive/Unarchive, Colour and Delete — Restore and Delete permanently in
  Trash. Esc or Cancel leaves; changing list leaves too.
- R66.3 Each note is its own request; partial failures say how many. Trash
  and Archive have Undo. Deleting permanently asks first.

### 4.67 Phone gestures

Owner picks 16, 17, 18 and 19.

- R67.1 Swipe right to pin: a row follows the finger rightwards over a grey
  Pin (or Unpin) panel that turns amber past the mark (22% of the row, kept
  between 64 and 96px); letting go past it pins and the row springs back.
  Not in Trash, not while selecting.
- R67.2 Pull to refresh: from the top of the list, pull down past 64px
  (damped, capped at 96) and let go: the list and the open note re-read from
  the server, as on returning to the app (§4.39), with a spinner until done.
  The list contains overscroll so the browser's own pull-to-reload does not
  fire instead.
- R67.3 Vibration: a 10ms tick when a swipe passes its mark, a pull passes
  its mark, a long-press starts selecting, a to-do is ticked, and on edge
  back. Android uses the Vibration API; iPhones expose no web haptics, but
  Safari 18 ticks when a switch checkbox toggles, so a hidden one is toggled;
  older iPhones stay silent. Settings → "Vibrate on gestures" turns it off.
- R67.4 Back gesture: the system back gesture already returns from a note
  to the list (R26.5). An app added to an iPhone's home screen has no system
  gesture, so there the editor follows a swipe from the left edge and,
  past a third of the width (at most 120px), returns to the list. Only
  there: Safari and Android own that edge themselves.

### 4.68 Hide titles when idle, and public share links

Owner picks 21 and 23. Schema (additive, rehearsed): `NoteShare` table, plus
`Note.locked` and `Settings.lockHash` for §4.69.

- R68.1 Idle: after 1, 5 (default) or 15 minutes with no pointer, key,
  scroll or touch activity, hidden titles (§4.59) turn on, until Show.
  Settings → "Hide titles when idle", or Never. Device-only.
- R68.2 Share link: a note's ⋯ menu → "Share link…" makes a read-only link
  (`/s/<token>`, 128 random bits), copies it, and offers "Stop sharing",
  which deletes it — the link is dead at once. One link per note; it shows
  the note as it is now, so later edits appear.
- R68.3 The shared page is rendered on the server by the Copy as HTML
  renderer (all text escaped, only safe links), with no app chrome, in a
  reading face, light or dark by the visitor's system. Not indexed
  (robots meta and X-Robots-Tag), never cached, `Referrer-Policy:
  no-referrer` so the link does not leak onward.
- R68.4 Images in a shared note load from `/s/<token>/a/<id>`, only when
  that note's text references that image; never cached, so revoking stops
  them too. The library's own image route stays behind the password.
- R68.5 A trashed or locked note's link stops opening (404) without being
  revoked; restoring or unlocking brings it back. Locked notes cannot get a
  link.

### 4.69 Lock a note

Owner pick 20. Against someone using your already signed-in device: a locked
note's text needs a second secret.

- R69.1 One passcode (4+ characters) for every locked note, set the first time
  a note is locked or from ⌘K. Stored as an scrypt hash in the settings row;
  the settings API now returns appearance columns by name only, so neither
  this nor the session epoch can reach a browser. It cannot be recovered;
  changing it needs the current one.
- R69.2 (Scoped per note since R69.7.) Unlocking sets a 15-minute httpOnly, SameSite=Strict cookie, HMAC-
  signed over its expiry and a fingerprint of the passcode hash — changing
  the passcode ends every unlock. Writing to a locked note restarts the 15
  minutes, so a long edit is never cut off. ⌘K "Lock locked notes now" ends
  it at once. Wrong passcodes: 10 per 10 minutes per IP, then refused.
- R69.3 While locked the server never sends the text: the list shows the
  title with "Locked" (no preview, thumbnail or to-do count); opening shows a
  passcode screen; the note API sends it sealed (no body); search matches the
  title only and never the text; tags, backlink previews and share links
  leave it out; history and restore refuse (423); writing or removing the
  lock refuses (423); a stale save's conflicted copy stays locked; exporting
  everything needs unlocking while any note is locked.
- R69.4 Locked notes are never kept in the offline copy: their responses
  carry `x-ursa-sensitive`, and the service worker drops them, deleting any
  copy kept before.
- R69.5 Locking a note leaves it open on this device until the unlock runs
  out or "Lock now"; returning to the app after that seals the open note.
  Pin, archive, colour and template labels work without unlocking.
- R69.7 *(v1.57.1)* Reported: "clicking on a locked note doesn't ask for
  the password". One unlock opened every locked note for 15 minutes, and
  setting the passcode unlocked too. Now an unlock is scoped to one note (the
  note id is in the signed cookie, so it cannot be widened), and the note
  locks again when you leave it — once its last edit has saved, so the save
  is never refused — or when the app goes to the background. Opening a
  locked note always asks. Exporting everything asks for the passcode with
  an "all" scope, which ends 5 seconds after the export starts. Locking a
  different note never ends another note's unlock.
- R69.6 Not end-to-end encryption: the text is stored as before, and anyone
  with the database could read it. The lock protects against the device,
  not the server.

### 4.70 Drag to reorder

Owner pick 5.

- R70.1 A grip (⋮⋮) shows beside the block under the mouse, or on a touch
  screen beside the caret's block at the right edge (a phone has no margin to
  its left). Dragging it shows a drop line between lines; letting go moves
  the block there. Esc cancels. Near the top or bottom edge the note scrolls.
- R70.2 A block is what reads as one thing: a list item with everything
  nested under it, a heading, a whole fenced code block, or a paragraph.
  Blank lines are never picked up, and a drop inside the block itself is
  nothing.
- R70.3 One transaction replacing only the lines touched, so one undo puts it
  back and the caret lands on the moved block. Off in reading mode and Trash.
- R70.4 Alt-↑/↓ already moves the current line from the keyboard.

### 4.71 Code copy, typewriter scrolling, Vim keys, starter templates

Owner picks 3, 23, 24 and 26 from round 2.

- R71.1 Every fenced code block has a Copy button in its top-right corner
  (faint until hovered; always visible on touch screens) that copies the code
  without its fences and says "Copied".
- R71.2 Typewriter scrolling (Settings or ⌘K): typing or moving the caret
  keeps its line centred; the text gets room below so its last line can be
  centred too. Device-only.
- R71.3 *(Removed in v1.59.1 at the owner's request.)* Vim keys were offered
  in Settings and ⌘K, via @replit/codemirror-vim; the option, the package
  and its styles are gone.
- R71.4 Starter templates: "Add starter templates" (Templates' empty list,
  or ⌘K) adds Meeting notes, Weekly review, Packing list, Recipe, Journal,
  Project plan and Daily note as ordinary templates — edit or delete them.
  Ones already present by title are skipped. Daily note is what today's note
  starts from (§4.65).

### 4.72 Voice typing and table tools

Owner picks 4 and 6 from round 2.

- R72.1 Voice typing: a microphone button in the format bar, where the browser
  has speech recognition (Chrome, Edge, Safari incl. iPhone; not Firefox,
  where it is hidden). Finished phrases are typed at the caret with a space
  before them; the phrase still being heard shows in a bubble above the bar.
  Phones end a session after a pause, so it restarts until stopped; leaving
  the note stops it. Language follows the browser's. Blocked or missing
  microphones say so.
- R72.1a *(v1.61.1)* Reported: "Voice typing needs a connection" on tapping
  the microphone. That is the browser's own speech service failing
  (`network`), which some Chromium browsers do not ship. It now retries once
  with the browser's on-device recognition where it exists; otherwise it
  says the service could not be reached and points to the keyboard's own
  microphone. Offline says so.
- R72.1b *(v1.64.1)* Reported: voice typing "stops after 1 sec" on every
  device. Browsers end a session after each pause and the app restarted the
  same recogniser from inside its end event, which several browsers refuse;
  the refusal was swallowed and listening stopped silently. Now each session
  is a fresh recogniser started 250 ms after the last ends (non-continuous,
  which phones handle best), listening continues until Stop, and three
  sessions in a row that hear nothing end it with the reason. Every error
  message carries the browser's error code, so a report says exactly what
  went wrong. The on-device retry of R72.1a is dropped: it needed language
  packs that are rarely installed.
- R72.2 `Permissions-Policy` now allows the microphone for this site itself
  (`microphone=(self)`); nothing embedded can ask for it. Camera, location
  and payment stay off.
- R72.3 Table tools: the format bar's table button is a menu — Insert table,
  and with the caret in a table: add row below, add column right, delete
  row, delete column, sort by the caret's column either way (numbers as
  numbers, text alphabetically). The header row and a table's last column
  cannot be deleted. The table is written back with padded, aligned columns,
  keeping each column's alignment; the caret lands in the affected cell. One
  undo reverts.
- R72.4 Found while testing: closing any format-bar menu (headings, lists,
  table) returned focus to the menu button, so the next keystroke or ⌘Z
  missed the note. Focus now goes back to the note.

### 4.73 Quick capture and the web clipper

Owner picks 15 and 16 from round 2.

- R73.1 Quick note: ⌘⇧Space, ⌘K "Quick note to Inbox", or the app icon's
  "Quick note" shortcut (long-press on a phone) opens a small box; ⌘↵ or
  Save adds the text to the end of the note titled "Inbox", made the first
  time. Each entry is a bullet with the time it was captured; further lines
  are indented under it. A draft survives closing the box; a failed save
  keeps the text.
- R73.2 The append happens on the server with the Inbox row locked, so two
  captures at once both land and an open Inbox elsewhere picks the entry up
  on its next resync. A locked Inbox refuses (423) with a message. Entries
  over 10,000 characters are refused.
- R73.3 Web clipper: Settings has a "Clip to mdNotes" bookmarklet to drag to
  the bookmarks bar (or copy as an address). On any page it opens a small
  window on the existing Save to mdNotes page (§4.31) with the page title,
  link and the selected text as a quote. Nothing is saved until Save — a GET
  never writes, as before — and the window closes itself after saving. Signed
  out, it goes through sign-in and back. Phones use the Share sheet instead.
- R73.4 *(v1.61.1)* Reported: on a phone the bookmark button "goes back to the
  list" — a bookmarklet cannot be dragged or run there, and tapping it only
  closed Settings. On touch screens the button is replaced by how to use the
  Share sheet.

### 4.74 Voice memos

Owner pick 17 from round 2.

- R74.1 A record button in the format bar (where the browser can record)
  starts recording after the microphone is allowed; a bubble shows a red dot,
  the time, Stop and Cancel. Stop uploads the audio and writes it on its own
  line as `[🎙 Voice memo · 0:42](/api/attachments/<id> "audio")`, which the
  editor draws as a player while the line is not being edited. Under a
  second is discarded. Recording stops itself at 15 minutes.
- R74.2 WebM/Opus where supported (Chrome, Firefox, Android), MP4/AAC on
  Safari and iPhone, at 32 kbps so 15 minutes fits the 4 MB upload cap.
  The server decides the type from the bytes (WebM, MP4, Ogg, MP3 accepted
  alongside images); the browser's claim is ignored as before.
- R74.3 The attachment route answers byte ranges (206), which Safari needs to
  play audio; the service worker passes ranged requests to the network.
- R74.4 Memos travel in exports as `attachments/<id>.webm|m4a|ogg|mp3` and come
  back on import, like images. Unused-image clean-up counts them as used
  while a note links them.

### 4.75 Import from other apps

Owner pick 18 from round 2. Settings → Import notes now takes:

- R75.1 Google Keep, as the Takeout .zip (or loose .json files): each note's
  title becomes a heading, its text and checklist (as to-dos) follow, links
  and images come along, labels become tags (`#weekly shop#` for labels with
  spaces), pinned stays pinned, archived goes to Archive, trashed notes are
  left out, and the creation date is kept. Keep's HTML copies are ignored
  quietly rather than listed as skipped.
- R75.2 Evernote .enex (from "Export notes"): title, creation date, tags and
  the body, converted from Evernote's HTML to markdown (headings, lists,
  bold, links, tables; Evernote checkboxes become to-dos). Images and audio
  inside the export are stored as attachments and placed where they were.
- R75.3 Notion ("Markdown & CSV" export) and Obsidian: images that a note
  links by relative path inside the zip are stored and the links rewritten;
  each image is stored once however many notes use it.
- R75.4 Every attachment goes through the same checks as an upload (type from
  the bytes, 4 MB each) and the import's 50 MB decompressed budget. As
  before, import only ever adds notes; it never changes existing ones.

### 4.76 Two-step sign-in

Owner pick 19 from round 2. Schema (additive, rehearsed): `Settings.totpSecret`,
`totpPending`, `recoveryCodes`, `totpLastStep` — server only; the settings API
returns appearance columns by name, so none can reach a browser.

- R76.1 Settings → Two-step sign-in → Set up shows a QR code (and the key as
  text) for any authenticator app; the first correct code turns it on. Ten
  single-use recovery codes are shown once, to copy; only their SHA-256
  hashes are kept. Turning it on signs out every other device (the session
  epoch is raised) and re-issues this browser's session.
- R76.2 Sign-in: the right password then asks for the 6-digit code (or "Lost
  your phone? Use a recovery code"). Asking is not a failure; a wrong code
  counts against the same per-address limit as a wrong password (10 in 10
  minutes). The password is kept while the code is asked for, never shown.
- R76.3 TOTP per RFC 6238 (HMAC-SHA1, 30 s, 6 digits), accepting the
  neighbouring step either side for clock drift. Each accepted code's step is
  recorded atomically, so a code cannot be used twice; a recovery code is
  deleted on use, under a row lock.
- R76.4 Turning it off needs a current code or a recovery code. If every
  recovery code and the phone are lost, it can only be turned off in the
  database (DEPLOYMENT.md): there is no email to reset through.

### 4.77 Automatic backups and emptying old trash

Owner picks 20 and 21 from round 2. Schema (additive, rehearsed): `Backup`
table and `Settings.trashDays`.

- R77.1 Every week a backup is made: every note not in the trash, as markdown
  with frontmatter in a zip — the files Export all makes, without images
  (they stay in the database; the full export carries them). The newest 8 are
  kept. There is no scheduler: the app asks once per visit, 8 seconds after
  launch, and the server makes one only when a week has passed.
- R77.2 Settings → Backups shows the last one, lists the others, downloads
  any of them, and "Back up now". Downloading needs locked notes unlocked,
  like a full export, and that unlock ends a few seconds later. The panel
  says plainly that backups live inside mdNotes — they guard against
  mistakes, not against losing the database — and to download one now and
  then.
- R77.3 Empty trash after 30 days: off by default; when on, notes trashed
  more than 30 days ago are deleted for good on the same visit check, and the
  list refreshes if any went. Restoring before then keeps a note.

