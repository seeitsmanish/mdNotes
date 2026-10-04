import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { guarded } from "@/lib/auth/session";
import { clientIp } from "@/lib/auth/clientIp";
import { clearFailures, isLimited, recordFailure } from "@/lib/db/loginFailures";
import { getLockHash, setLockHash } from "@/lib/db/settings";
import { countLocked } from "@/lib/db/notes";
import { hashPasscode, MIN_PASSCODE, UNLOCK_COOKIE, UNLOCK_MINUTES, unlockedScope, unlockToken, validScope, verifyPasscode } from "@/lib/lock/passcode";
import { isUnlocked } from "@/lib/lock/state";

/**
 * The note-lock passcode (PRD §4.69).
 *
 * GET says whether one is set and whether this browser is unlocked.
 * POST { action: "setup", passcode, current?, scope? } sets or changes it;
 * POST { action: "unlock", passcode, scope } unlocks one note (its id), or
 * "all" for exporting everything, for 15 minutes;
 * POST { action: "lock" } locks again now.
 * Wrong passcodes are limited per IP like wrong passwords (10 in 10 minutes),
 * in their own count.
 */

async function handleGET() {
  // "unlocked" here means everything — what exporting needs.
  const [hash, unlocked, lockedNotes] = await Promise.all([getLockHash(), isUnlocked(), countLocked()]);
  return NextResponse.json({ configured: hash !== null, unlocked, lockedNotes });
}

async function setUnlocked(hash: string, scope: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET missing");
  (await cookies()).set(UNLOCK_COOKIE, unlockToken(hash, secret, scope), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: UNLOCK_MINUTES * 60,
  });
}

async function handlePOST(request: Request) {
  let payload: { action?: unknown; passcode?: unknown; current?: unknown; scope?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const { action, passcode, current, scope } = payload;

  if (action === "lock") {
    // With a scope, only that note's unlock ends — leaving note A must not
    // lock note B, opened since. Without one, everything locks.
    const jar = await cookies();
    const secret = process.env.AUTH_SECRET;
    const hash = await getLockHash();
    const current = secret ? unlockedScope(jar.get(UNLOCK_COOKIE)?.value, hash, secret) : null;
    if (!validScope(scope) || current === null || current === scope) jar.delete(UNLOCK_COOKIE);
    return NextResponse.json({ unlocked: false });
  }

  if (typeof passcode !== "string" || passcode.length < MIN_PASSCODE || passcode.length > 128) {
    return NextResponse.json({ error: `The passcode needs at least ${MIN_PASSCODE} characters.` }, { status: 400 });
  }

  const ip = `lock:${clientIp(request.headers)}`;
  if (await isLimited(ip)) {
    return NextResponse.json({ error: "Too many wrong passcodes. Wait a few minutes and try again." }, { status: 429 });
  }

  const hash = await getLockHash();

  if (action === "setup") {
    if (hash) {
      if (typeof current !== "string" || !(await verifyPasscode(current, hash))) {
        await recordFailure(ip);
        return NextResponse.json({ error: "Your current passcode isn’t right." }, { status: 403 });
      }
    }
    const next = await hashPasscode(passcode);
    await setLockHash(next);
    await clearFailures(ip);
    // Setting the passcode while locking a note keeps that note open here.
    if (validScope(scope)) await setUnlocked(next, scope);
    else (await cookies()).delete(UNLOCK_COOKIE);
    return NextResponse.json({ configured: true, unlocked: validScope(scope) });
  }

  if (action === "unlock") {
    if (!hash) return NextResponse.json({ error: "No passcode is set yet." }, { status: 409 });
    if (!validScope(scope)) return NextResponse.json({ error: "Say which note to unlock." }, { status: 400 });
    if (!(await verifyPasscode(passcode, hash))) {
      await recordFailure(ip);
      return NextResponse.json({ error: "That passcode isn’t right." }, { status: 403 });
    }
    await clearFailures(ip);
    await setUnlocked(hash, scope);
    return NextResponse.json({ unlocked: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

export const GET = guarded(handleGET);
export const POST = guarded(handlePOST);
