# Ursa — Technical Specification (v1.1)

Implementation companion to [PRD.md](./PRD.md). Requirement IDs (R1.1, R2.2 …)
refer to that document.

---

## 1. Stack

| Layer | Choice | Why this one |
|---|---|---|
| Framework | Next.js 16, App Router | Route handlers give an API without a second service |
| Language | TypeScript, strict | The editor is the risky code and it is exactly where types help |
| Styling | Tailwind v4 | CSS-first config; theme tokens live in `@theme` and plain custom properties |
| Editor | CodeMirror 6 + Lezer | Decoration-based styling, incremental parsing, and **nested language parsing inside fences** |
| Database | PostgreSQL 16 | Asked for; gives `tsvector` free when search needs to scale |
| ORM | Prisma 7 | Typed client, migration history, driver adapter via node-postgres |
| Local infra | Docker Compose | One `up` for Postgres, no host install |
| Client state | Zustand | Selection and UI preferences only. Server data is fetched, not mirrored |

## 2. Architecture

```
  Browser
  ┌──────────────────────────────────────────────────┐
  │ app/page.tsx  (server component — initial fetch) │
  │   └ <Shell>                        client island │
  │       ├ <NoteList>   search, filters, rows       │
  │       ├ <EditorPane> toolbar + <Editor>          │
  │       ├ <CommandPalette>  ⌘K                     │
  │       └ <Toast>      undo for destructive actions│
  │              │                                   │
  │              │ debounced PATCH                   │
  └──────────────┼───────────────────────────────────┘
                 ▼
  app/api/notes/route.ts           ──┐  all DB access via
  app/api/notes/[id]/route.ts        ├─ lib/db/notes.ts
  app/api/notes/[id]/restore/route.ts┘  (and lib/db/write.ts)
                 ▼
        Prisma ──► PostgreSQL (Docker)
```

**The one rule:** no route handler touches `prisma` directly. Every query lives
in `lib/db/`. That is the seam that makes the deferred `userId` column (PRD §7) a
one-file change instead of a sweep.

## 3. Data model

```prisma
model Note {
  id        String    @id @default(cuid())
  body      String    @default("")   // raw markdown, the source of truth
  title     String    @default("")   // derived on write, denormalised for list queries
  excerpt   String    @default("")   // derived on write
  pinned    Boolean   @default(false)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt     // sync hook, PRD §7
  deletedAt DateTime?                // soft delete → Trash, also a sync hook
  @@index([deletedAt, pinned, updatedAt])
}
```

One table. v1.0 had `Tag` and `NoteTag`; v1.1 dropped both when tagging stopped
being an organising system (PRD §2).

**Why `title` and `excerpt` are columns.** R4.4 derives both from the body, so
they are redundant. They are stored anyway because the note list would otherwise
have to ship every full body to the client to render a list of rows. They are
written only in `lib/db/write.ts`, never by callers — that single writer is what
keeps them from drifting from the text.

## 4. The editor

The hard part of the app, and where v1.1 spent its budget.

### 4.1 Why Lezer replaced the hand-rolled parser

v1.0 parsed markdown with a bespoke tokeniser. It worked for Bear's own
constructs, but it had two structural limits:

1. **It could not highlight a fenced block.** A hand-rolled markdown parser knows
   a fence is a fence, and nothing about the JSON inside it. The only honest fix
   is a parser that can delegate a region to another language's parser.
2. **It reparsed the whole document on every keystroke** (~7ms at 47k chars),
   because it had no incremental structure.

`@codemirror/lang-markdown` solves both: Lezer parses incrementally, and
`codeLanguages` hands a fence's contents to the matching language parser, loaded
lazily from `@codemirror/language-data`.

### 4.2 Bear's own syntax — `components/editor/bearMarkup.ts`

Three `MarkdownConfig` extensions, since Bear's markup is not CommonMark:

| Node | Syntax | Approach |
|---|---|---|
| `Highlight` | `::text::` | Delimiter pair, resolved like emphasis |
| `SlashEmphasis` | `/text/` | Delimiter pair, **guarded hard** — the opener must start a word and the closer end one, or every file path and URL becomes italic |
| `BearTag` | `#tag`, `#multi word tag#` | Inline element. Cosmetic only since v1.1 |

The `#` rule is the one that goes wrong in clones. `#` followed by a space is a
heading and never reaches the tag parser, because ATXHeading is a *block* parser
and consumes the line first. Everything else is covered by the test table in
`bearMarkup.test.ts`, which runs against the real Lezer tree:

| Input | Result |
|---|---|
| `# Heading` | heading, not a tag |
| `#tag` | tag |
| `#work/nested` | tag — `/` nests |
| `#multi word tag#` | one tag, spaces included |
| `#one and #two#` | two tags, not one long one |
| `C#` / `issue #42` | plain text |
| `` `#tag` `` / inside a fence | plain text |

### 4.3 Decorations — `components/editor/decorations.ts`

A `ViewPlugin` that walks the syntax tree over `view.visibleRanges` only (R2.5)
and emits:

- **Marker hiding.** `HeaderMark`, `EmphasisMark`, `CodeMark`, `LinkMark`, `URL`
  and friends become `Decoration.replace` unless the caret is on their line.
- **Fenced blocks.** Every line of a `FencedCode` gets a background; the first and
  last also get rounded corners and the vertical padding, so the block reads as
  one container. The backticks are hidden and `CodeInfo` is replaced by a small
  uppercase language chip.
- **Task items.** `TaskMarker` becomes a real checkbox widget that rewrites the
  underlying text. The sibling `ListMark` is hidden, since the checkbox already
  marks the row.
- **List bullets.** Styled as a decoration, *not* via the highlight style —
  Lezer's `t.list` tag covers a list's entire content, so styling it there paints
  every list item accent-red. This is a mistake worth not repeating.

### 4.4 Highlight style — `components/editor/highlightStyle.ts`

Maps Lezer tags to CSS classes, never to inline colours, so the palette stays in
`globals.css` and all five themes are defined in one place. Two groups: markdown
structure (`strong`, `emphasis`, `monospace`, …) and code tokens (`keyword`,
`string`, `number`, `propertyName`, …). The second group is what makes ```json
look like JSON.

### 4.5 Persistence — `components/editor/useAutosave.ts`

Debounce 400ms (R2.4). A per-note in-flight guard means a pending save for note A
is *flushed*, not cancelled, when the user jumps to note B. Flush triggers are
blur, note switch, and `visibilitychange → hidden` — the last is what makes
"kill the tab" hold in the success criteria.

The save response merges every field **except `body`**: the user may have typed
more since the request left, and overwriting the editor's source text would undo
those keystrokes.

## 5. API

All JSON. No auth in v1 (PRD §2); every handler is a thin shell over `lib/db`.

| Method | Path | Body / query | Returns |
|---|---|---|---|
| `GET` | `/api/notes` | `?filter=all\|pinned\|trash&q=` | `{ notes, counts }` — no bodies |
| `POST` | `/api/notes` | — | created note |
| `GET` | `/api/notes/:id` | — | full note with `body` |
| `PATCH` | `/api/notes/:id` | `{ body?, pinned? }` | updated note; re-derives title/excerpt |
| `DELETE` | `/api/notes/:id` | `?permanent=true` | soft delete, or hard when permanent |
| `POST` | `/api/notes/:id/restore` | — | clears `deletedAt` |

Counts ride along with the list so the filter control never needs its own round
trip.

## 6. Theming

Five palettes (Light, Sepia, Graphite, Midnight, plus System) each define the
same token set as CSS custom properties. Light sits on bare `:root`; System picks
up Graphite under `prefers-color-scheme` via `:root:not([data-theme])`; an
explicit choice stamps `data-theme` on `<html>` and always wins. An inline script
in `app/layout.tsx` applies the stored choice before first paint (R3.5).

`--row-active` is deliberately a tint rather than the accent itself. A saturated
block for the selected row is the loudest thing on screen at list density, and it
is what made the first build look unfinished.

Editor measure, text size and typeface are custom properties on the editor host
element, so the controls in `SettingsPanel` change one variable rather than
re-theming anything.

## 7. Keyboard map

| Keys | Action |
|---|---|
| `⌘N` | New note |
| `⌘K` | Command palette |
| `⌘F` | Focus search |
| `⌘.` | Focus mode |
| `⌘1` `⌘2` | Focus list / editor |
| `↑` `↓` | Move within the list |
| `⌘P` | Pin / unpin |
| `⌘⌫` | Move to trash |
| `⌘B` `⌘I` `⌘K` | Bold, italic, link |
| `⌘⇧H` `⌘⇧C` `⌘⇧X` `⌘⇧7` | Highlight, inline code, strike, todo |

## 8. Testing

- `components/editor/bearMarkup.test.ts` — the §4.2 table against the real Lezer
  tree, plus GFM constructs the editor relies on (task markers, `CodeInfo`,
  tables, links) and a parse-time budget on a 50k-character note.
- `lib/markdown/derive.test.ts` — title and excerpt derivation, including the
  fence-line case from R4.4.

The editor's *rendering* is verified by hand and by screenshot against the seed
library, which is written to exercise every styled construct.

## 9. Local development

```bash
docker compose up -d        # Postgres 16 on :5432
pnpm install
pnpm db:push                # or db:migrate for a migration history
pnpm db:seed
pnpm dev                    # http://localhost:3000
```

`.env` holds only `DATABASE_URL`. `.env.example` is committed; `.env` is not.
Prisma 7 keeps the URL out of `schema.prisma` — the CLI reads it from
`prisma.config.ts` and the runtime client gets it through the pg driver adapter.
