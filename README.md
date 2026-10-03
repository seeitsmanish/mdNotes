# Ursa

A web clone of [Bear](https://bear.app) — single-pane markdown notes. You type
markdown and it styles itself in place; the syntax markers show only on the line
the caret is on. There is no preview pane.

See [docs/PRD.md](docs/PRD.md) for scope and [docs/TECH-SPEC.md](docs/TECH-SPEC.md)
for how it is built.

## Running it

Requires Node 22+, pnpm, and Docker (for Postgres).

```bash
cp .env.example .env
pnpm install
pnpm setup       # starts Postgres, pushes the schema, seeds a few notes
pnpm dev         # http://localhost:3000
```

`pnpm setup` is these three rolled together, if you'd rather run them separately:

```bash
docker compose up -d   # Postgres 16 on :5432
pnpm db:push           # schema → database
pnpm db:seed           # a library that exercises every styled construct
```

Other scripts: `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm db:studio`,
`pnpm db:down`.

## The editor

Built on CodeMirror 6 with Lezer's markdown parser, so a fenced block is really
parsed in the language it declares:

````markdown
```json
{ "name": "ursa", "private": true }
```
````

…renders with JSON tokens coloured, the backticks hidden, and a small `JSON` chip
labelling the block. Around thirty languages are supported, loaded on demand.

| Construct | Syntax |
|---|---|
| Headings | `# ` … `###### ` |
| Bold / italic | `**bold**`, `*italic*`, `/italic/` |
| Strike / highlight | `~~struck~~`, `::highlighted::` |
| Code | `` `inline` ``, triple-backtick fences |
| Todo | `- [ ]`, `- [x]` — the checkbox is clickable |
| Tables | GFM pipe tables |
| Tag | `#tag` — styled as a pill, but it files nothing |

`#` followed by a space is a heading; `#` followed by anything else is a tag.
Tags inside code spans and fenced blocks stay literal.

## Keyboard

| Keys | Action |
|---|---|
| `⌘N` | New note |
| `⌘K` | Command palette |
| `⌘F` | Search |
| `⌘.` | Focus mode |
| `⌘1` `⌘2` | Focus list / editor |
| `⌘P` | Pin or unpin |
| `⌘⌫` | Move to trash |
| `⌘B` `⌘I` `⌘K` | Bold, italic, link |
| `⌘⇧H` `⌘⇧C` `⌘⇧X` `⌘⇧7` | Highlight, inline code, strike, todo |

## Appearance

Five themes — Light, Sepia, Graphite, Midnight, and System. Editor measure, text
size and typeface are adjustable from the toolbar's appearance panel. All of it
persists per browser and applies before first paint.

## Layout

```
app/              Next.js App Router — the page and the JSON API
components/
  editor/         CodeMirror 6: Bear's syntax, decorations, highlight style, autosave
  shell/          Note list, editor pane, command palette, settings, toasts
lib/
  markdown/       Title and excerpt derivation
  db/             Every Prisma query lives here; no route handler touches the ORM
  store/          Zustand — UI state only
prisma/           Schema and seed
docs/             PRD and technical spec
```

Two rules hold the design together:

1. **One writer.** Every change to a note body goes through `lib/db/write.ts`, so
   the derived title and excerpt cannot drift from the text.
2. **One palette.** Every colour is a CSS custom property defined once per theme.
   No component hardcodes a colour, and the editor's highlight style emits
   classes rather than inline colours.

## Not included

Accounts, sync, wiki-links, export, attachments, and import from a real Bear
library. Tagging as an *organising system* was removed in v1.1 — `#tag` still
styles, but there is no tag table, sidebar, or filtering. PRD §7 lists the seam
left for each deferred feature; notably, notes are stored as raw markdown, which
is also how Bear stores them, so an importer is a read and an insert rather than
a conversion.
