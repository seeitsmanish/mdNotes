# Deploying Ursa

Written for a cold start: a fresh clone, a fresh host, no prior context. The
free tiers of Vercel and Neon are enough to run this.

---

## 1. What you need

| | |
|---|---|
| **Host** | Vercel (free Hobby tier is sufficient) |
| **Database** | Postgres. Neon's free tier is what this was built against |
| **Node** | 22+ locally, for the CLI steps |
| **Repo** | Optional but recommended — connect it for push-to-deploy |

---

## 2. Generate the two secrets

```bash
openssl rand -base64 32          # → AUTH_SECRET
```

Pick a password for `APP_PASSWORD`. There are no user accounts: this one
password opens the app, so make it long. It is compared in constant time and
rate limited, but it is the only gate.

---

## 3. Create the project and database

```bash
pnpm install -g vercel
vercel login
vercel link                      # creates the project

# Provision Postgres and wire DATABASE_URL in automatically
vercel integration add neon
```

`vercel integration add neon` provisions a database, connects it to the project
and injects `DATABASE_URL` plus a set of `POSTGRES_*` variables.

It also writes a local `.env.local`. **Delete that file** — Next gives it higher
priority than `.env`, so leaving it makes local development silently read the
cloud database:

```bash
rm .env.local
```

---

## 4. Set the secrets on the host

```bash
printf '%s' 'your-password'   | vercel env add APP_PASSWORD production
printf '%s' 'your-32+-secret' | vercel env add AUTH_SECRET  production
```

Repeat with `preview` if you want preview deployments to work — without these,
preview builds will 500 on sign-in.

> Environment changes only take effect on the **next** deployment. Changing a
> variable does not update the running one.

---

## 5. Create the schema

Neon's pooled endpoint (the host containing `-pooler`) runs through PgBouncer,
which **cannot execute DDL**. Migrations must use the unpooled URL:

```bash
vercel env pull /tmp/neon.env --environment production
UNPOOLED=$(grep '^DATABASE_URL_UNPOOLED=' /tmp/neon.env | cut -d'"' -f2)
pnpm prisma db push --url "$UNPOOLED"
rm /tmp/neon.env
```

The app's runtime connection uses the **pooled** URL, which is correct — only
schema changes need the direct one.

**On every release that changes `prisma/schema.prisma`, run this step before
deploying.** New code selecting a column the database lacks fails every note
query. Ursa's schema changes so far are additive (a new column with a default),
which the previous release ignores, so pushing the schema first is always safe;
deploying first is not.

---

## 6. Deploy

```bash
pnpm verify                      # typecheck + tests + build. Do not skip this
vercel deploy --prod --yes
```

Then open the URL, sign in with `APP_PASSWORD`, and confirm the notes list
loads. An empty list is correct on a fresh database; a "can't reach its
database" screen means step 5 did not run.

---

## 7. Back it up

**Neon's free tier has no point-in-time recovery.** Export is the only recovery
path, so take a backup before you rely on the app:

```bash
URSA_URL=https://your-app.vercel.app pnpm backup
```

That writes a dated zip to `backups/`. Every note carries its id, creation date
and pinned state as frontmatter, so importing the archive into an empty
database reproduces the library rather than a flattened copy.

Schedule it. A weekly `cron` entry is enough:

```cron
0 9 * * 1 cd /path/to/ursa && /usr/local/bin/pnpm backup
```

To restore: sign in, open **Appearance → Import notes**, and select the zip.

---

## 8. Running against a different host

Nothing here is Vercel-specific except the CLI. The app is a standard Next.js
app with three environment variables and one Postgres database, so any host that
runs Next 16 works. If you move it:

- Keep `AUTH_SECRET` stable or every session is signed out
- Point `DATABASE_URL` at the pooled connection string if your provider has one
- Run `prisma db push` against the direct connection before the first boot

---

## 9. Custom domain (www.mdnotes.in)

The app needs no code change for a domain: the CSP, cookies and share target
are all relative to whatever host serves it.

1. Vercel → the project → **Settings → Domains** → add `www.mdnotes.in`, then
   add `mdnotes.in` and choose **Redirect to www.mdnotes.in** (308).
2. At the registrar's DNS for `mdnotes.in`:
   - `A` record, host `@`, value `76.76.21.21`
   - `CNAME` record, host `www`, value `cname.vercel-dns.com`

   Remove any other `A`/`AAAA`/`CNAME` records on `@` and `www` (parking
   pages). Use the exact values Vercel shows on the Domains page if they
   differ — Vercel sometimes issues a project-specific CNAME.
3. Wait for both rows on the Domains page to show **Valid Configuration**;
   Vercel issues the HTTPS certificate itself.
4. Sign in once on the new domain — a session cookie belongs to the host it
   was set on. On a phone, remove the installed app and install it again from
   `https://www.mdnotes.in`: an installed app is tied to its origin.

The `*.vercel.app` address keeps working. `pnpm backup` now defaults to
`https://www.mdnotes.in`; set `URSA_URL` to back up from another host.

## Locked out of two-step sign-in

If the phone with the authenticator app and every recovery code are lost,
turn two-step sign-in off in the database (Neon's SQL editor):

```sql
UPDATE "Settings" SET "totpSecret" = NULL, "totpPending" = NULL, "recoveryCodes" = NULL, "totpLastStep" = 0;
```

Then sign in with the password alone, and set it up again from Settings.

## Troubleshooting

| Symptom | Cause |
|---|---|
| "Ursa can't reach its database" | Schema never pushed (step 5), or `DATABASE_URL` is wrong |
| Sign-in returns 500 | `APP_PASSWORD` or `AUTH_SECRET` missing on the host |
| Sign-in returns 401 with the right password | Env change not deployed — redeploy |
| Everything 401s after a deploy | `AUTH_SECRET` changed; that invalidates all sessions by design |
| `db push` fails with "database server is not running" | You used the pooled URL; use `DATABASE_URL_UNPOOLED` |
| Local dev shows an empty library | A stray `.env.local` is pointing you at the cloud database |
| Build fails on `useSearchParams` | A client component reading search params needs a `<Suspense>` boundary |

---

## Notes for whoever maintains this

- `middleware.ts` is **deprecated in Next 16** — the edge gate is `proxy.ts`,
  and the export is named `proxy`.
- `typedRoutes` is on, so `router.push`/`replace` reject dynamic strings without
  a cast.
- Prisma 7 keeps the connection URL **out of `schema.prisma`**: the CLI reads it
  from `prisma.config.ts` and the runtime client gets it through the pg driver
  adapter in `lib/db/prisma.ts`.
- The generated Prisma client lives outside `node_modules`, so
  `@prisma/client-runtime-utils` is a direct dependency — pnpm will not link it
  otherwise.
- There is no CI. Run `pnpm verify` before every deploy; it is one command and
  it propagates exit codes correctly.
