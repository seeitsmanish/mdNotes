import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, safeEqual, sessionKey, signToken } from "@/lib/auth/token";
import { getSessionEpoch } from "@/lib/db/settings";

/**
 * There are no accounts — one password opens the app. The cookie it issues is
 * httpOnly and signed, so it cannot be read or forged by page scripts.
 */

// Deliberately coarse: enough to make an online guessing attack impractical
// without needing a store. Resets when the server does, which is acceptable
// for a single-user app.
const attempts = new Map<string, { count: number; firstAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAt: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(request: Request) {
  const password = process.env.APP_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!password || !secret) {
    return NextResponse.json(
      { error: "Server is missing APP_PASSWORD or AUTH_SECRET." },
      { status: 500 },
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let submitted: unknown;
  try {
    submitted = (await request.json())?.password;
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  if (typeof submitted !== "string" || !safeEqual(submitted, password)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  attempts.delete(ip);

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
