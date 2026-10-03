# The development loop

A routine for an AI agent continuing work on Ursa autonomously.

This is written from a session that shipped v1.2 → v1.11 this way. The rules
below are not style preferences; each one exists because skipping it caused a
specific, named failure in that session. The failures are recorded so you do not
have to repeat them to learn them.

---

## 0. Before touching anything

Read, in this order: `README.md`, `docs/PRD.md`, `docs/TECH-SPEC.md`. Then run:

```bash
pnpm install
pnpm verify          # typecheck + tests + build. Must pass before you change anything
```

If `pnpm verify` fails on a clean checkout, **fix that first**. You cannot tell
your regressions from inherited ones otherwise.

Confirm the local database is running and seeded:

```bash
docker compose up -d && pnpm db:push && pnpm db:seed
```

---

## 1. The cycle

Each iteration is one user-visible change, shipped. Do not batch several
features into one release — when something breaks you want one suspect.

```
 ① Pick        → one feature or one defect
 ② Specify     → add a numbered section to docs/PRD.md
 ③ Build       → pure logic first, with tests, then wire the UI
 ④ Verify      → pnpm verify, then prove it in a real browser
 ⑤ Release     → bump, release note, commit, tag
 ⑥ Deploy      → push the build SHA, deploy, check production read-only
 ⑦ Report      → tell the user, with a large heading
```

### ① Pick

Draw from, in priority order:

1. **Defects you have verified** — reproduce before you believe, including bugs
   reported by other agents or by the user.
2. **Data-integrity and durability work.** It outranks features. A notes app
   that loses a note has no other qualities.
3. The deferred list in PRD §7 and the open questions in PRD §8.
4. New features.

Prefer the thing that would be embarrassing to discover later over the thing
that demos well.

### ② Specify

Add a `### 4.N <name>` section to `docs/PRD.md` before writing code, with
numbered requirements (`R<N>.1`, `R<N>.2` …). Say what the feature must do and
*why*, including what you deliberately decided not to do. Reference the
requirement ids in commit messages.

This is not ceremony. It is how the next agent — or you after a context
compaction — knows whether a behaviour is a bug or a decision.

### ③ Build

- **Pure logic goes in its own module with its own tests**, and must not import
  `lib/db/prisma`. That client throws at import time without `DATABASE_URL`, so
  a validator that imports it cannot be unit tested. This already happened once
  with the settings sanitiser; the fix was `lib/settings/schema.ts`.
- Respect the five rules in the README's "Rules the code holds to". If you need
  to break one, say why in the commit.
- Write the test that would have caught the bug, not the test that passes.

### ④ Verify

```bash
pnpm verify
```

**Never pipe test output through `tail`/`grep` and chain with `&&`.** The pipe
masks vitest's exit code and a failing suite will sail through. That happened in
the originating session and a release shipped on a red build. `pnpm verify`
exists specifically so exit codes propagate.

Then **prove it in a browser**. Typecheck and unit tests do not catch: CSS
specificity, CodeMirror runtime constraints, hydration mismatches, focus
behaviour, or anything about how it looks. In the originating session, browser
checks caught a crashed command palette, a block-decoration exception, zeroed
heading padding and an invisible checkbox — none of which any test saw.

Drive the browser against the **preview database**, never the live one:

```bash
# one-time
docker exec ursa-postgres psql -U ursa -d postgres -c "CREATE DATABASE ursa_preview OWNER ursa;"
pnpm prisma db push --url "postgresql://ursa:ursa@localhost:5432/ursa_preview?schema=public"

# per run (Next 16 refuses two dev servers in one directory, so stop the main one)
pkill -f "next dev"
DATABASE_URL="postgresql://ursa:ursa@localhost:5432/ursa_preview?schema=public" pnpm next dev -p 3100
```

### ⑤ Release

```bash
# 1. bump package.json version (semver: feature → minor, fix → patch)
# 2. prepend an entry to RELEASES in lib/release/releases.ts
# 3. pnpm verify            ← again, after the version bump
# 4. commit, then tag
git tag -a v1.X.0 -m "v1.X.0 — <title>"
```

`lib/release/releases.test.ts` asserts the newest release matches
`package.json`, so these cannot drift.

Release notes are written **for the person using the app**, not for the repo.
"Fixed a bug that could silently truncate a note" — not "fix stale-read race in
Shell.tsx". Commit messages are where the mechanism goes.

### ⑥ Deploy

```bash
SHA=$(git rev-parse --short HEAD)
printf '%s' "$SHA" | vercel env add NEXT_PUBLIC_COMMIT_SHA production --force
vercel deploy --prod --yes
git push && git push --tags
```

Then check production — **read-only**. Status codes, auth rejection, a search
that returns results. Do **not** create, edit or delete notes against the live
database to test a write path; that is what the preview database is for.

### ⑦ Report

Lead with a large markdown heading so the release is visible at a glance:

```markdown
# 🚀 RELEASED — v1.X.0
# <what it does, in plain words>
### <the URL>
```

Then: what shipped, what you verified and how, and anything you found but did
not fix.

---

## 2. Rules that are not negotiable

### The user's notes are not test data

`pnpm db:seed` **deletes every note first**. Running it against a database
holding real notes destroys them. In the originating session this wiped a note
the user had written minutes earlier. Never seed a database you did not create.

If a verification run creates notes, delete exactly those and confirm the count
returns to what it was.

### Verify a claim before acting on it

Reports from other agents, and your own recollection, are hypotheses. Reproduce
in a browser or with `curl` first. In the originating session three separate
"critical" claims were checked: all three were real, and the checking took
minutes while the fixes took longer — but a fourth, assumed without checking,
turned out to be a test-script bug, not a product bug.

### Say what you broke

If you lose data, corrupt a note, or ship a regression, say so plainly and
immediately, with what was lost and whether it is recoverable. Do not bury it
under a summary of what went well.

### Destructive actions get confirmed

Anything that drops a table, deletes rows, force-pushes, or rotates a secret:
ask first, state the blast radius, and say whether it can be undone. Prisma will
refuse a destructive `db push` and demand explicit consent — that refusal is
correct, do not route around it.

### Never commit a secret

`.env` is gitignored. Before any commit that touches configuration:

```bash
git diff --cached --name-only | grep -x '\.env' && echo "STOP"
git diff --cached | grep -c "$(grep '^APP_PASSWORD=' .env | cut -d'"' -f2)"
```

---

## 3. Traps in this stack

Each of these cost real time in the originating session.

| Trap | What happens | The rule |
|---|---|---|
| **Next 16 renamed `middleware.ts`** | Writing `middleware.ts` silently does nothing | The edge gate is `proxy.ts`, exporting `proxy` |
| **`typedRoutes` is on** | `router.push(someString)` fails typecheck | Cast to `Parameters<typeof router.replace>[0]` |
| **`useSearchParams` breaks the build** | Production build fails, dev is fine | Wrap the client component in `<Suspense>` |
| **CodeMirror base theme out-specifies bare classes** | `.cm-line { padding }` silently resolves to CodeMirror's value | Scope every `.cm-*` rule under `.cm-editor` |
| **Block decorations from a ViewPlugin throw** | "Block decorations may not be specified via plugins" — editor fails to mount | Anything replacing a line break goes in a `StateField` (see `tableField.ts`) |
| **Prisma 7 moved the datasource URL** | `url` in `schema.prisma` is rejected | It lives in `prisma.config.ts`; runtime uses the pg adapter |
| **Prisma client is generated outside `node_modules`** | Module-not-found at runtime under pnpm | `@prisma/client-runtime-utils` is a direct dependency |
| **Neon's pooled endpoint cannot run DDL** | `db push` reports the server is not running | Migrate with `DATABASE_URL_UNPOOLED` |
| **`vercel integration add neon` writes `.env.local`** | Local dev silently reads the cloud database and your notes look deleted | Delete `.env.local` |
| **Zustand `persist` vs SSR** | Hydration mismatch warnings | `skipHydration: true` plus `persist.rehydrate()` on mount |
| **Vercel env changes need a redeploy** | Password change appears not to work | Deploy after `vercel env add` |
| **`main` auto-deploys to production** | Pushing a schema-dependent change ships code ahead of its column; every note query 500s (v1.12.0, reverted) | Push the schema to Neon *before* the commit that needs it reaches `main`. An agent here cannot reach Neon or Vercel — ask the user to run DEPLOYMENT.md §5 first |
| **Wall-clock assertions are flaky** | Perf test fails from machine load and blocks a deploy | Take the best of N samples |

---

## 4. Where things live

| You want to change | Go to |
|---|---|
| What markdown means | `components/editor/bearMarkup.ts` (Lezer extensions) |
| How markdown looks while editing | `components/editor/decorations.ts`, `highlightStyle.ts` |
| Anything replacing whole lines | `components/editor/tableField.ts` (StateField, not a plugin) |
| Saving behaviour | `components/editor/useAutosave.ts` |
| A database query | `lib/db/` — **never** a route handler |
| Anything derived from a note body | `lib/db/write.ts`, the single writer |
| Colour, theme, spacing | `app/globals.css` — tokens only, no component hardcodes a colour |
| A keyboard shortcut | `components/editor/commands.ts` + `lib/shortcuts/map.ts` (both, or the help dialog lies) |

---

## 5. Current priorities

Taken from a five-perspective product review. Re-verify before acting — these
were accurate when written and the code moves.

1. ~~**CI.**~~ Done in v1.11.1 — `.github/workflows/verify.yml` runs
   `pnpm verify` on every push and PR (PRD §4.17). A red check means do not
   deploy.
2. ~~**Optimistic concurrency on save.**~~ Done in v1.12.0 (PRD §4.18): a
   `version` column, a conditional UPDATE, a 409, and the stale text kept as a
   conflicted copy server-side. First shipped before the production schema had
   the column and reverted; re-landed after the column was added on Neon.
3. ~~**Note history.**~~ Done in v1.18.0 (PRD §4.28).
4. **Postgres FTS.** Search is `ILIKE` with a 500-row cap and no `ORDER BY`;
   past 500 matches, results are nondeterministic.
5. **Error monitoring.** Every client `catch` is silent. A production failure
   produces no signal anywhere.
6. ~~**Recall features.**~~ Tried as Drill mode (v1.14.0) and **removed at the
   user's request** in v1.15.2. Do not revisit quizzes, flashcards or spaced
   repetition without asking. Ask what the user wants before inventing
   features. The unshipped spoilers branch (fe0fa0a) was built for the same
   study use; check with the user before reviving it.

---

## 6. Finishing a session

Leave the repository in a state someone else can pick up:

- `pnpm verify` passes
- Working tree clean, commits and tags pushed
- `docs/PRD.md` describes what actually shipped
- Anything found-but-not-fixed is written down here or in the PRD
- Local dev server left running against the **local** database, not preview

Then say, plainly, what is done and what is not.
