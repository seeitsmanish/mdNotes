import { cache } from "react";
import { prisma } from "../db/prisma";
import { type AppSettings, DEFAULT_SETTINGS } from "../settings/schema";

/**
 * The one settings row (PRD R6.5). Reads are forgiving — a brand new database
 * has no row yet, and appearance must never be why the app fails to render.
 */

const SINGLETON = "singleton";

export async function getSettings(): Promise<AppSettings> {
  const row = await prisma.settings.findUnique({ where: { id: SINGLETON } });
  if (!row) return DEFAULT_SETTINGS;
  // sessionEpoch is a server secret of sorts, not appearance: never sent on.
  const { id: _id, updatedAt: _updatedAt, sessionEpoch: _epoch, ...settings } = row;
  return settings;
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const row = await prisma.settings.upsert({
    where: { id: SINGLETON },
    update: patch,
    create: { id: SINGLETON, ...DEFAULT_SETTINGS, ...patch },
  });
  const { id: _id, updatedAt: _updatedAt, sessionEpoch: _epoch, ...settings } = row;
  return settings;
}

/**
 * One read per request: the root layout needs the appearance to render <html>
 * and the page needs it for the shell, and they should not query twice.
 */
export const getSettingsForRequest = cache(getSettings);

/**
 * The session epoch (PRD §4.30), read fresh on every authenticated request.
 *
 * Deliberately not cached. An in-memory cache was tried and was wrong: Next
 * bundles the login route, the logout route and the page separately, each
 * with its own copy of this module, so right after "sign out everywhere" the
 * page kept accepting old sessions and the login route kept issuing them
 * under the old epoch until the copies expired. One primary-key read per
 * request is cheap; a sign-out that does not sign out is not.
 */
export async function getSessionEpoch(): Promise<number> {
  const row = await prisma.settings.findUnique({ where: { id: SINGLETON }, select: { sessionEpoch: true } });
  return row?.sessionEpoch ?? 0;
}

/** End every session everywhere. Returns the new epoch. */
export async function bumpSessionEpoch(): Promise<number> {
  const row = await prisma.settings.upsert({
    where: { id: SINGLETON },
    update: { sessionEpoch: { increment: 1 } },
    create: { id: SINGLETON, ...DEFAULT_SETTINGS, sessionEpoch: 1 },
    select: { sessionEpoch: true },
  });
  return row.sessionEpoch;
}
