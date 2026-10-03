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
  `# <title> (conflicted copy)`, in the same transaction. The response is a 409
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
