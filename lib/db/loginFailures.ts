import { prisma } from "./prisma";

/** Failed sign-ins (PRD §4.33). Every query lives here. */

export const LOGIN_WINDOW_MS = 10 * 60 * 1000;
export const MAX_FAILURES = 10;
const KEEP_MS = 24 * 60 * 60 * 1000;

export async function isLimited(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const failures = await prisma.loginFailure.count({ where: { ip, at: { gte: since } } });
  return failures >= MAX_FAILURES;
}

export async function recordFailure(ip: string): Promise<void> {
  await prisma.$transaction([
    prisma.loginFailure.create({ data: { ip } }),
    // Housekeeping on write: nothing older than a day is ever consulted.
    prisma.loginFailure.deleteMany({ where: { at: { lt: new Date(Date.now() - KEEP_MS) } } }),
  ]);
}

/** A successful sign-in clears that address's failures. */
export async function clearFailures(ip: string): Promise<void> {
  await prisma.loginFailure.deleteMany({ where: { ip } });
}
