# Security audit — 2026-10-03 (v1.11.1 → v1.11.2)

Scope: the whole app as deployed — auth and session handling, the edge gate,
every route handler, the editor's handling of note content, import/export,
response headers, and dependencies. Method: code review of every file in
`app/`, `lib/auth`, `proxy.ts` and the editor's URL/DOM sinks, then each
suspected finding **reproduced in a real browser** against the preview
database before it was rated. Ratings assume the threat model below.

**Threat model.** One user, one password, notes that may be private. The
attacker is anyone on the internet who can reach the URL or get the user to
click a link, plus untrusted *content*: notes imported from Bear/Obsidian
exports or pasted from elsewhere. The user themself is trusted.

## Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| A1 | Medium | Open redirect after sign-in | **Fixed** in v1.11.2 |
| A2 | Medium | Links in notes opened with any URL scheme, including `javascript:` | **Fixed** in v1.11.2 |
| A3 | Medium | No security headers: frameable (clickjacking), no CSP | **Fixed** in v1.11.2 |
| A4 | Low | Import decompressed zip entries without a size cap (zip bomb) | **Fixed** in v1.11.2 |
| A5 | Medium | Sessions cannot be revoked; sign-out does not end a stolen session | Open — mitigation below |
| A6 | Low | Edge gate accepted an `AUTH_SECRET` shorter than 32 characters | **Fixed** in v1.11.2 |
| A7 | Low | Login rate limit is per server instance and resets on cold start | Open |
| A8 | Low | Four dependency advisories, all in build-time tooling | Open |

### A1 — Open redirect after sign-in (fixed)

`/login?next=/\evil.example` passed the check
`next.startsWith("/") && !next.startsWith("//")`, and browsers read `/\` as
`//`. **Reproduced:** after signing in, the browser navigated to
`http://example.org/phish`. A phishing link to the real login page could hand
a freshly signed-in user to a look-alike site.

Fix: `safeNextPath()` in `lib/security/urls.ts` resolves `next` against the
app's own origin and keeps it only if the origin is unchanged. Tested against
`//`, `/\`, `/\/`, tab-split and absolute URLs.

### A2 — Unsafe link schemes (fixed)

⌘/Ctrl-click on a link passed its URL straight to `window.open`. Notes come
from imports, so a note could carry `[x](javascript:…)`. **Reproduced in
Chromium:** the popup opened as `about:blank` and the script did *not* run —
Chromium refuses `javascript:` in a `noopener` window. Not verified in
Safari or Firefox, and the app should not depend on browser behaviour for
this, so it is rated Medium rather than High.

Fix: `safeExternalUrl()` allows only `http:`, `https:` and `mailto:`;
everything else is refused before `window.open`. Table cells were checked and
already render links as inert text.

### A3 — Security headers (fixed)

No CSP, no `X-Frame-Options`, no `nosniff`. The app could be framed by any
site and clicked through. Now set for every response in `next.config.ts`:

- `Content-Security-Policy` — `default-src 'self'`, `connect-src 'self'`,
  `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
  `frame-ancestors 'none'`
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive
  `Permissions-Policy`

**Limit, stated plainly:** `script-src` includes `'unsafe-inline'`, because
Next's inline bootstrap scripts need it without per-request nonces. The CSP
therefore does not stop an injected inline script from *running*; it stops
such a script from *sending notes anywhere* (`connect-src 'self'`) or loading
code from elsewhere. Nonces are the follow-up (see below).

Verified against a production build (`next start`): every page, lazy-loaded
code-block languages, autosave, the palette, export and import work with zero
CSP violations; framing is refused.

### A4 — Zip bomb on import (fixed)

The 50 MB cap was on the *compressed* upload; markdown entries were then
inflated whole with `async("string")`. A small zip of repeated text inflates
to gigabytes and would kill the function. Requires a signed-in session, hence
Low. Fix: `readEntryCapped()` in `lib/export/unzip.ts` streams each entry and
abandons it past 2 MB, with a 50 MB budget across all entries. Verified: a
30 MB entry is reported as "larger than 2 MB" and the rest of the zip imports.

### A5 — Sessions cannot be revoked (open)

A session is a signed expiry with no server-side record, valid for 30 days.
Signing out clears the cookie in *this* browser only; a copied cookie keeps
working until it expires. Changing `APP_PASSWORD` does not end sessions
either.

**Mitigation today:** rotate `AUTH_SECRET` in Vercel and redeploy. That ends
every session on every device. Do this whenever a session cookie may have
been exposed — including one pasted into a chat or a bug report.

**Fix (needs a schema change):** a session epoch stored in the `Settings`
row and embedded in each token; sign-out-everywhere and password changes bump
it. Deferred until the schema-on-deploy process is settled (PRD §4.18 was
reverted for exactly that reason).

### A6 — Short secret at the edge (fixed)

`proxy.ts` verified tokens with any non-empty `AUTH_SECRET`, while route
handlers required 32+ characters. No bypass existed, since handlers re-check,
but the two gates now agree and both fail closed.

### A7 — Login rate limiting is per instance (open)

10 attempts per IP per 10 minutes, held in memory. Serverless instances do
not share it and cold starts reset it, so a distributed guesser gets far more
attempts. The real defence is the password: use a long random one. Proper
fix: a Vercel Firewall rate-limit rule on `/api/auth/login`, or a counter in
Postgres.

### A8 — Dependency advisories (open, low)

`pnpm audit --prod` reports 3 high and 1 moderate, all in tooling that never
runs in the deployed app: `mysql2` and `deepmerge-ts` under the Prisma CLI,
and `braces` under the shadcn CLI. `shadcn` and `cn` are listed as runtime
dependencies but are CLI/unused; moving them to devDependencies would clear
the shadcn path.

## Checked and sound

- **Tokens:** HMAC-SHA256 over the expiry, verified with a constant-time
  comparison before the expiry is trusted.
- **Fail closed:** a missing or short `AUTH_SECRET` locks the app.
- **Every route is guarded:** 13 of the 15 handlers under `app/api` are wrapped
  in `guarded()`; the other two are login and logout, which must be public.
  The page calls `hasSession()`. The edge
  gate is a second fence, not the only one.
- **Cookie:** `httpOnly`, `Secure` in production, `SameSite=Lax`. All
  state-changing endpoints are POST/PATCH/DELETE, which Lax keeps cross-site
  requests from carrying the cookie to — no CSRF path found.
- **Injection:** no raw SQL anywhere (Prisma only); no user content reaches
  `innerHTML` (table cells are built as DOM nodes; the one
  `dangerouslySetInnerHTML` is a static theme script).
- **Settings:** strictly validated (`#rrggbb` colours, enumerated values)
  before they become CSS custom properties.
- **Login:** constant-time password comparison, 429 after repeated failures.

## Follow-ups, in order

1. Rotate `AUTH_SECRET` now (A5 mitigation) — a live session cookie was shared
   during this audit.
2. Session epoch for real sign-out (A5).
3. CSP nonces to drop `'unsafe-inline'` (A3).
4. Vercel Firewall rule on `/api/auth/login` (A7).
5. Move `shadcn`/`cn` to devDependencies (A8).
