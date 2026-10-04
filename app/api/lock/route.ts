import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { guarded } from "@/lib/auth/session";
import { clientIp } from "@/lib/auth/clientIp";
import { clearFailures, isLimited, recordFailure } from "@/lib/db/loginFailures";
import { getLockHash, setLockHash } from "@/lib/db/settings";
import { hashPasscode, MIN_PASSCODE, UNLOCK_COOKIE, UNLOCK_MINUTES, unlockToken, verifyPasscode } from "@/lib/lock/passcode";
import { isUnlocked } from "@/lib/lock/state";

/**
 * The note-lock passcode (PRD §4.69).
 *
 * GET says whether one is set and whether this browser is unlocked.
 * POST { action: "setup", passcode, current? } sets or changes it;
 * POST { action: "unlock", passcode } unlocks for 15 minutes;
 * POST { action: "lock" } locks again now.
 * Wrong passcodes are limited per IP like wrong passwords (10 in 10 minutes),
 * in their own count.
 */

async function handleGET() {
  const [hash, unlocked] = await Promise.all([getLockHash(), isUnlocked()]);
  return NextResponse.json({ configured: hash !== null, unlocked });
}

async function setUnlocked(hash: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET missing");
  (await cookies()).set(UNLOCK_COOKIE, unlockToken(hash, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: UNLOCK_MINUTES * 60,
  });
}

async function handlePOST(request: Request) {
  let payload: { action?: unknown; passcode?: unknown; current?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const { action, passcode, current } = payload;

  if (action === "lock") {
    (await cookies()).delete(UNLOCK_COOKIE);
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
    await setUnlocked(next);
    return NextResponse.json({ configured: true, unlocked: true });
  }

  if (action === "unlock") {
    if (!hash) return NextResponse.json({ error: "No passcode is set yet." }, { status: 409 });
    if (!(await verifyPasscode(passcode, hash))) {
      await recordFailure(ip);
      return NextResponse.json({ error: "That passcode isn’t right." }, { status: 403 });
    }
    await clearFailures(ip);
    await setUnlocked(hash);
    return NextResponse.json({ unlocked: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

export const GET = guarded(handleGET);
export const POST = guarded(handlePOST);
