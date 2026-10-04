import type { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, sessionKey, signToken } from "@/lib/auth/token";
import { getSessionEpoch } from "@/lib/db/settings";

/** Sets a fresh session cookie on a response, under the current epoch. */
export async function issueSession(response: NextResponse): Promise<void> {
  const secret = process.env.AUTH_SECRET!;
  const password = process.env.APP_PASSWORD!;
  const token = await signToken(sessionKey(secret, password), await getSessionEpoch());
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}
