import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, safeEqual, sessionKey, signToken } from "@/lib/auth/token";
import { getSessionEpoch } from "@/lib/db/settings";
import { clientIp } from "@/lib/auth/clientIp";
import { clearFailures, isLimited, recordFailure } from "@/lib/db/loginFailures";

/**
 * There are no accounts — one password opens the app. The cookie it issues is
 * httpOnly and signed, so it cannot be read or forged by page scripts.
 */

// Failed attempts are counted in the database, per client address, so every
// server instance sees the same count (PRD §4.33). The in-memory counter
// this replaces reset on every cold start (security audit A7).

export async function POST(request: Request) {
  const password = process.env.APP_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!password || !secret) {
    return NextResponse.json(
      { error: "Server is missing APP_PASSWORD or AUTH_SECRET." },
      { status: 500 },
    );
  }

  const ip = clientIp(request.headers);
  if (await isLimited(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let submitted: unknown;
  try {
    submitted = (await request.json())?.password;
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  if (typeof submitted !== "string" || !safeEqual(submitted, password)) {
    await recordFailure(ip);
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  await clearFailures(ip);

  const response = NextResponse.json({ ok: true });
  const token = await signToken(sessionKey(secret, password), await getSessionEpoch());
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
