# Ursa

A single-user markdown notes app. You type markdown and it styles itself in
place — there is no preview pane, and syntax markers appear only on the line
the caret is on.

Built with Next.js 16, CodeMirror 6 + Lezer, Postgres via Prisma, and shadcn/ui.

![version](https://img.shields.io/badge/version-1.22.0-6ee7a8) ![tests](https://img.shields.io/badge/tests-334-6ee7a8)

---

## What it does

**Editing**
- Live markdown: headings, bold, italic, strikethrough, `::highlight::`, `/italic/`
- Fenced code blocks parsed **in the language they declare** — ` ```json ` is really highlighted as JSON (~30 languages, loaded on demand)
- Tables render as real tables, and turn back into markdown when you click into one
- Clickable to-do checkboxes, list continuation on Enter, smart paste of URLs
- Images: paste, drop or pick — resized in the browser, stored privately
- Floating format bar, and an outline panel for long notes (`⌘⇧O`)
- Live math: end a line with `=` and the answer appears — names, `%`, currencies and `total`

**Finding things**
- Ranked search: a note *titled* after your query beats one that merely mentions it
- Matched text is highlighted in the result, accent-insensitively (`cafe` finds `Café`)
- `⌘K` command palette

**Connecting things**
- `[[Note title]]` wiki-links, matched loosely on case and spacing
- Backlinks shown on every note
- Unresolved links offer to create the note

**Owning your data**
- History: earlier versions of every note, with a preview of what restoring brings back
- Streaming export to a zip of `.md` files, with id/created/pinned as frontmatter — and your images
- Import from a zip or loose markdown — works with Bear and Obsidian exports
- `pnpm backup` writes a dated archive to local disk

**Appearance**
- Five themes, an accent colour picker, radius/width/padding/text-size/typeface controls
- Appearance syncs across devices; layout preferences stay per-device
- Editing one note on two devices never loses text: a stale save is kept as a conflicted copy

**On your phone**
- Installable as an app — home-screen icon, full screen, offline notice
- Share to Ursa from any app; long-press the icon for New note / Search

**Access**
- Single password, HMAC-signed httpOnly cookie, enforced at the edge *and* in every route handler
- Sign out everywhere; changing the password ends every session
- CSP and anti-framing headers; links in notes open only for http(s)/mailto — see [docs/SECURITY-AUDIT.md](docs/SECURITY-AUDIT.md)

Full requirements live in [docs/PRD.md](docs/PRD.md); architecture in
[docs/TECH-SPEC.md](docs/TECH-SPEC.md); deploying it in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). If you are an AI agent continuing this
work, start with [docs/AGENT-LOOP.md](docs/AGENT-LOOP.md).

---

## Running it locally

Requires **Node 22+**, **pnpm**, and **Docker** (for Postgres).

```bash
cp .env.example .env     # then edit it — see "Environment" below
pnpm install
pnpm setup               # starts Postgres, pushes the schema, seeds demo notes
pnpm dev                 # http://localhost:3000
```

`pnpm setup` is these three, if you'd rather run them separately:

```bash
docker compose up -d     # Postgres 16 on :5432
pnpm db:push             # schema → database
pnpm db:seed             # demo notes that exercise every styled construct
```

### Environment

`.env` is gitignored. Copy `.env.example` and fill in:

| Variable | What it is | How to get one |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | The Docker default in `.env.example` works locally |
| `APP_PASSWORD` | The single password that opens the app | Choose a long one |
| `AUTH_SECRET` | Signs the session cookie, **32+ characters** | `openssl rand -base64 32` |

The app **fails closed**: a missing or short `AUTH_SECRET` locks it rather than
opening it.

### Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm verify` | **generate + typecheck + tests + build** — run before any deploy; CI runs it on every push |
| `pnpm test` | 334 unit tests |
| `pnpm backup` | Download a dated backup zip to `backups/` |
| `pnpm db:push` / `db:migrate` / `db:studio` / `db:seed` | Prisma |
| `pnpm db:up` / `db:down` | Docker Postgres |

---

## Layout

```
app/
  api/             JSON API — notes, auth, settings, export, import, resolve
  login/           Password gate
  page.tsx         Server-rendered initial fetch
components/
  editor/          CodeMirror: Bear syntax, decorations, tables, autosave, format bar
  shell/           Note list, editor pane, palette, settings, outline, backlinks
  ui/              shadcn/ui on Base UI
lib/
  auth/            HMAC session tokens, request-scoped guard
  db/              Every Prisma query — no route handler touches the ORM
  markdown/        Title/excerpt derivation, wiki-links, table parsing
  search/          Ranking and snippets
  export/          Filenames, frontmatter, import rules
  store/           Zustand — UI state only
proxy.ts           Edge auth gate (Next 16 renamed middleware → proxy)
prisma/            Schema and seed
docs/              PRD, tech spec, deployment
```

### Rules the code holds to

1. **One writer.** Every note-body change goes through `lib/db/write.ts`, so the
   derived title and excerpt cannot drift from the text.
2. **One parser.** The editor and the server read markdown through the same
   Lezer tree. A second implementation would eventually disagree with the first.
3. **No route handler touches Prisma.** All queries live in `lib/db/`, which is
   the seam that makes a future `userId` column a one-file change.
4. **One palette.** Every colour is a CSS custom property defined once per theme.
5. **Derived, not stored.** Backlinks and wiki-link resolution are computed on
   read rather than kept in a join table that could fall out of step.

---

## Known gaps

Honest list, for whoever picks this up next:

- **Errors are logged, not alerted.** Client failures reach the server log and
  `/api/health` reports database status, but nothing pages anyone.
- **Schema is managed by `prisma db push`**, not migrations — there is no
  `prisma/migrations/` history and no rollback path.
- **Search scans rather than indexes.** Candidates are found by an
  accent-folded `ILIKE` (title and body separately, newest 500 of each), so it
  is correct but does a full scan. Postgres `tsvector` is the planned fix.
- **No live sync between devices.** Saves are conflict-checked (PRD §4.18), so
  two devices can no longer overwrite each other — but a device only learns of
  the other's edit when it next saves or reopens the note.
- **Deleting a note leaves its images stored**, since an image may appear in
  several notes; there is no orphan clean-up yet. No diagrams.
- **No offline editing** — the installed app shows an offline notice, but
  reading and writing notes needs a connection.
- **Tests cover pure modules only**; the stateful editor and shell code has no
  component or integration tests.

See the PRD's deferred list for the seam left for each.
