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
