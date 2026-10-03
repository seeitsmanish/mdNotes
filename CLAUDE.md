@AGENTS.md

# Working on this repo

**Read [docs/AGENT-LOOP.md](docs/AGENT-LOOP.md) before starting.** It is the
routine for continuous development here: how to pick work, specify it, verify
it, release it, and the traps in this stack that have already cost time.

Three things that matter most, in case you read nothing else:

1. **`pnpm verify` before every deploy.** Never pipe test output through `tail`
   and chain with `&&` — the pipe masks the exit code and a red build will ship.
2. **Never run `pnpm db:seed` against a database holding real notes.** It
   deletes every note first. Use the preview database for anything destructive.
3. **Verify a claim in a browser before fixing it.** Typecheck and unit tests do
   not catch CSS specificity, CodeMirror runtime constraints, or hydration bugs.
