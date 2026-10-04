/**
 * Download a dated backup of every note (PRD R16.5).
 *
 * Deliberately a plain script rather than a hosted cron: a backup that lives on
 * the same infrastructure as the data is only half a backup, and this way the
 * archive lands somewhere the hosting provider cannot delete.
 *
 *   pnpm backup                      # backs up the deployed app
 *   pnpm backup http://localhost:3000
 *
 * Needs APP_PASSWORD, and URSA_URL unless a URL is passed.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_URL = process.env.URSA_URL ?? "https://www.mdnotes.in";
const OUT_DIR = process.env.URSA_BACKUP_DIR ?? "backups";

async function main() {
  const base = (process.argv[2] ?? DEFAULT_URL).replace(/\/$/, "");
  const password = process.env.APP_PASSWORD;
  if (!password) throw new Error("APP_PASSWORD is not set. It is read from .env.");

  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!login.ok) throw new Error(`Sign-in failed (${login.status}). Check APP_PASSWORD.`);

  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("No session cookie returned.");

  // Trashed notes are included: a backup is not the place to apply judgement
  // about what is worth keeping.
  const response = await fetch(`${base}/api/export?trashed=true`, { headers: { cookie } });
  if (!response.ok) throw new Error(`Export failed (${response.status}).`);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = join(OUT_DIR, `ursa-${stamp}.zip`);

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(file, Buffer.from(await response.arrayBuffer()));

  const { size } = await import("node:fs").then((fs) => fs.promises.stat(file));
  console.log(`Backed up ${base} → ${file} (${(size / 1024).toFixed(1)} kB)`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
