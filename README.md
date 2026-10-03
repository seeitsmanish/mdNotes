# Ursa

A single-user markdown notes app. You type markdown and it styles itself in
place — there is no preview pane, and syntax markers appear only on the line
the caret is on.

Built with Next.js 16, CodeMirror 6 + Lezer, Postgres via Prisma, and shadcn/ui.

![version](https://img.shields.io/badge/version-1.11.3-6ee7a8) ![tests](https://img.shields.io/badge/tests-174-6ee7a8)

---

## What it does

**Editing**
- Live markdown: headings, bold, italic, strikethrough, `::highlight::`, `/italic/`
- Fenced code blocks parsed **in the language they declare** — ` ```json ` is really highlighted as JSON (~30 languages, loaded on demand)
- Tables render as real tables, and turn back into markdown when you click into one
- Clickable to-do checkboxes, list continuation on Enter, smart paste of URLs
- Floating format bar, and an outline panel for long notes (`⌘⇧O`)

**Finding things**
- Ranked search: a note *titled* after your query beats one that merely mentions it
- Matched text is highlighted in the result, accent-insensitively (`cafe` finds `Café`)
- `⌘K` command palette

**Connecting things**
- `[[Note title]]` wiki-links, matched loosely on case and spacing
- Backlinks shown on every note
- Unresolved links offer to create the note

**Owning your data**
- Streaming export to a zip of `.md` files, with id/created/pinned as frontmatter
- Import from a zip or loose markdown — works with Bear and Obsidian exports
- `pnpm backup` writes a dated archive to local disk

**Appearance**
- Five themes, an accent colour picker, radius/width/padding/text-size/typeface controls
- Appearance syncs across devices; layout preferences stay per-device

**Access**
- Single password, HMAC-signed httpOnly cookie, enforced at the edge *and* in every route handler
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
| `pnpm test` | 174 unit tests |
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

- **No error monitoring**, no structured logging, no health check.
- **Schema is managed by `prisma db push`**, not migrations — there is no
  `prisma/migrations/` history and no rollback path.
- **Search uses `ILIKE`** with a 500-row candidate cap and no `ORDER BY`, so past
  500 matching notes the results are nondeterministic. Postgres `tsvector` is
  the planned fix.
- **No concurrency control on save.** Two devices editing the same note is
  last-write-wins. The stale-read race that truncated notes is fixed, but a
  `version` column is still the right answer.
- **No images or attachments**, no math, no diagrams.
- **No offline support** — the app needs a network.
- **Tests cover pure modules only**; the stateful editor and shell code has no
  component or integration tests.

See the PRD's deferred list for the seam left for each.
