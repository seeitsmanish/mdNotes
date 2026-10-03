# PM review — 2026-10-03 (overnight run)

Five perspectives on Ursa as it stands at v1.17.0, each proposing work. The
user is the only user: they keep interview-question notes, use the app on a
phone and as an installed app, and rejected a speculative study feature
(Drill, v1.14 → removed). So every proposal below has to answer "would the
person who writes these notes actually use this?" — and anything that
touches their data outranks anything that adds to it.

## Data-integrity PM

> A notes app that loses a note has no other qualities.

- **Note history** — every save overwrites the last; a bad paste, an
  accidental select-all-delete, or a wrong conflict resolution is
  unrecoverable once the tab's undo stack is gone (it is lost on every note
  switch). Keep earlier versions and let them be restored. **P1.**
- **Images in exports** — v1.15 added images but the export zip, the only
  backup path, does not contain them. A restore from backup silently loses
  every image. **P1.**

## Security PM

- **Revocable sessions** (audit A5) — sign-out ends nothing; a leaked cookie
  works for 30 days, and one *was* pasted into a chat on 2026-10-03. Add
  "Sign out everywhere", and make a password change end old sessions. **P1.**
- **Rate limit that survives cold starts** (A7) — per-instance memory resets
  on every new serverless instance. Count failures in Postgres. **P2.**
- **Runtime dependency hygiene** (A8) — `shadcn`/`cn` are CLI tools listed as
  runtime dependencies. **P3.**

## Tech PM

- **Error reporting** — every client failure vanishes into a console nobody
  reads. Report them to the server log, where Vercel keeps them. **P2.**
- **Health check** — a cheap endpoint that says whether the database
  answers, for uptime checks. **P3.**

## Phone / creative PM

- **Share to Ursa** — on a phone, ideas arrive in other apps: a link in
  Chrome, a paragraph in an article, an interview question in a message.
  The installed app should appear in the system share sheet and turn what is
  shared into a note. **P2.**
- **Home-screen shortcuts** — long-press the icon for "New note" and
  "Search". **P3.**

## Innovation PM

- **Embeds** (`![[Note]]`) — show one note inside another, live. Useful for
  a "master list" that pulls in per-company question notes. Speculative
  given the Drill lesson; **parked** until the user asks.

## Order for tonight

1. Note history (integrity)
2. Images in exports (integrity)
3. Revocable sessions + sign out everywhere (security)
4. Share to Ursa + shortcuts (phone)
5. Error reporting + health check (tech)
6. Persistent login rate limit (security)

Each ships separately: spec in PRD.md, tests, verify, browser check on the
preview database, push to main, CI green before the next.

---

## What shipped overnight (2026-10-03, v1.18.0 → v1.23.2)

Every item: a PRD section, tests, `pnpm verify`, a browser check against
the preview database on a production build, push to `main`, CI green.
Every schema change was additive, rehearsed on a temporary Neon branch with
note/character counts compared to production, and applied before the code
that needed it.

| Version | PM | What | PRD |
|---|---|---|---|
| 1.18.0 | Integrity | Note history: versions kept, preview with highlighted lines, restore | §4.28 |
| 1.18.1 | Integrity | Exports include images; import restores them | §4.29 |
| 1.19.0 | Security | Sign out / sign out everywhere; password change ends sessions (A5) | §4.30 |
| 1.20.0 | Phone | Share to Ursa from any app; home-screen shortcuts | §4.31 |
| 1.21.0 | Tech | Client errors to the server log; `/api/health` | §4.32 |
| 1.21.1 | Security | Failed sign-ins counted in Postgres (A7) | §4.33 |
| 1.21.2 | Security | `shadcn` to devDependencies (A8, partial) | — |
| 1.22.0 | Security | Per-request nonce CSP, no `'unsafe-inline'` scripts (A3) | §4.34 |
| 1.23.0 | Integrity | Clean up unused images, on request | §4.35 |
| 1.23.1 | Design | Appearance panel scrolls (was cut off on phones and 720px screens) | R26.6 |
| 1.23.2 | A11y | AA contrast in every theme; editor and sliders named | §4.36 |

Bugs found by verification before they shipped: the history dialog compared
against stale text; a per-bundle epoch cache let signed-out sessions through
for seconds; the Search shortcut did not focus; my own test scripts were
wrong three times (and said so in the commits).

A regression sweep across both layouts after the batch found nothing broken.

## Recommended next, in order

1. **Prisma migration history.** Schema changes are rehearsed and applied by
   hand; a baseline `prisma/migrations/` would give future changes a record
   and a rollback path. Touches production (`_prisma_migrations` table), so
   worth doing with the owner awake.
2. **Real offline editing.** The installed app shows an offline page; editing
   offline needs a local copy and a merge on reconnect — §4.18's conflict
   copies are the safe base.
3. Anything the owner asks for. Two speculative features this week were
   wrong (Drill, removed; spoilers, parked). Ask first.
