import { cache } from "react";
import { prisma } from "../db/prisma";
import { type AppSettings, DEFAULT_SETTINGS } from "../settings/schema";

/**
 * The one settings row (PRD R6.5). Reads are forgiving — a brand new database
 * has no row yet, and appearance must never be why the app fails to render.
 */

const SINGLETON = "singleton";

/**
 * Only the appearance columns, by name. The row also holds server secrets —
 * the session epoch and the note-lock passcode hash (PRD §4.69) — and a
 * deny-list would send the next one added to every browser.
 */
const APPEARANCE = Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((key) => [key, true])) as Record<
  keyof AppSettings,
  true
>;

export async function getSettings(): Promise<AppSettings> {
  const row = await prisma.settings.findUnique({ where: { id: SINGLETON }, select: APPEARANCE });
  return row ?? DEFAULT_SETTINGS;
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  return prisma.settings.upsert({
    where: { id: SINGLETON },
    update: patch,
    create: { id: SINGLETON, ...DEFAULT_SETTINGS, ...patch },
    select: APPEARANCE,
  });
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

/** The note-lock passcode hash (PRD §4.69), or null when none is set. Server only. */
export async function getLockHash(): Promise<string | null> {
  const row = await prisma.settings.findUnique({ where: { id: SINGLETON }, select: { lockHash: true } });
  return row?.lockHash ?? null;
}

export async function setLockHash(lockHash: string): Promise<void> {
  await prisma.settings.upsert({
    where: { id: SINGLETON },
    update: { lockHash },
    create: { id: SINGLETON, ...DEFAULT_SETTINGS, lockHash },
  });
}

/** Two-step sign-in state (PRD §4.76). Server only. */
export async function getTotpState(): Promise<{ secret: string | null; pending: string | null; lastStep: number; recovery: string[] }> {
  const row = await prisma.settings.findUnique({
    where: { id: SINGLETON },
    select: { totpSecret: true, totpPending: true, totpLastStep: true, recoveryCodes: true },
  });
  let recovery: string[] = [];
  try {
    recovery = row?.recoveryCodes ? (JSON.parse(row.recoveryCodes) as string[]) : [];
  } catch {
    recovery = [];
  }
  return { secret: row?.totpSecret ?? null, pending: row?.totpPending ?? null, lastStep: row?.totpLastStep ?? 0, recovery };
}

export async function setTotpPending(pending: string | null): Promise<void> {
  await prisma.settings.upsert({
    where: { id: SINGLETON },
    update: { totpPending: pending },
    create: { id: SINGLETON, ...DEFAULT_SETTINGS, totpPending: pending },
  });
}

export async function enableTotp(secret: string, step: number, recoveryHashes: string[]): Promise<void> {
  await prisma.settings.update({
    where: { id: SINGLETON },
    data: { totpSecret: secret, totpPending: null, totpLastStep: step, recoveryCodes: JSON.stringify(recoveryHashes) },
  });
}

export async function disableTotp(): Promise<void> {
  await prisma.settings.update({
    where: { id: SINGLETON },
    data: { totpSecret: null, totpPending: null, totpLastStep: 0, recoveryCodes: null },
  });
}

/** Records a used code's step; false if a code from this step or later was already used (a replay). */
export async function consumeStep(step: number): Promise<boolean> {
  const result = await prisma.settings.updateMany({
    where: { id: SINGLETON, totpLastStep: { lt: step } },
    data: { totpLastStep: step },
  });
  return result.count === 1;
}

/** Uses up a recovery code by its hash; false if it is not (or no longer) there. */
export async function consumeRecovery(hash: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ recoveryCodes: string | null }>>`
      SELECT "recoveryCodes" FROM "Settings" WHERE "id" = ${SINGLETON} FOR UPDATE`;
    let codes: string[] = [];
    try {
      codes = rows[0]?.recoveryCodes ? (JSON.parse(rows[0].recoveryCodes) as string[]) : [];
    } catch {
      return false;
    }
    if (!codes.includes(hash)) return false;
    await tx.settings.update({ where: { id: SINGLETON }, data: { recoveryCodes: JSON.stringify(codes.filter((c) => c !== hash)) } });
    return true;
  });
}

