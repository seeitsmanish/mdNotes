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
