import { NextResponse } from "next/server";
import { hasSession } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/token";
import { UNLOCK_COOKIE } from "@/lib/lock/passcode";
import { bumpSessionEpoch } from "@/lib/db/settings";
import { crossSiteRefusal, isCrossSiteWrite } from "@/lib/security/origin";

/**
 * Sign out. With `?everywhere=true`, end every session on every device
 * (PRD §4.30) — only for a signed-in caller, so a stranger cannot sign the
 * owner out.
 */
export async function POST(request: Request) {
  if (isCrossSiteWrite(request.method, request.headers)) return crossSiteRefusal();
  const everywhere = new URL(request.url).searchParams.get("everywhere") === "true";
  if (everywhere) {
    if (!(await hasSession())) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }
    await bumpSessionEpoch();
  }

  const response = NextResponse.json({ ok: true, everywhere });
  response.cookies.set(SESSION_COOKIE, "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  // A note unlocked in this browser locks again on sign-out (PRD §4.69).
  response.cookies.set(UNLOCK_COOKIE, "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
