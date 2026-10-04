import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/auth/token";
import { getTotpState } from "@/lib/db/settings";
import { issueSession } from "@/lib/auth/issue";
import { checkSecondFactor } from "@/lib/auth/secondFactor";
import { clientIp } from "@/lib/auth/clientIp";
import { clearFailures, isLimited, recordFailure } from "@/lib/db/loginFailures";
import { crossSiteRefusal, isCrossSiteWrite } from "@/lib/security/origin";

/**
 * There are no accounts — one password opens the app. The cookie it issues is
 * httpOnly and signed, so it cannot be read or forged by page scripts.
 */

// Failed attempts are counted in the database, per client address, so every
// server instance sees the same count (PRD §4.33). The in-memory counter
// this replaces reset on every cold start (security audit A7).

export async function POST(request: Request) {
  if (isCrossSiteWrite(request.method, request.headers)) return crossSiteRefusal();
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
  let code: unknown;
  try {
    const body = (await request.json()) as { password?: unknown; code?: unknown };
    submitted = body?.password;
    code = body?.code;
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  if (typeof submitted !== "string" || !safeEqual(submitted, password)) {
    await recordFailure(ip);
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  // Two-step sign-in (PRD §4.76): the right password then asks for a code.
  // Asking is not a failure; a wrong code is, and counts like a wrong password.
  const totp = await getTotpState();
  if (totp.secret) {
    if (typeof code !== "string" || !code.trim()) {
      return NextResponse.json({ needsCode: true, error: "Enter the 6-digit code from your authenticator app." }, { status: 401 });
    }
    const used = await checkSecondFactor(totp.secret, totp.lastStep, code);
    if (!used) {
      await recordFailure(ip);
      return NextResponse.json({ needsCode: true, error: "That code isn’t right. Codes change every 30 seconds." }, { status: 401 });
    }
  }

  await clearFailures(ip);

  const response = NextResponse.json({ ok: true });
  await issueSession(response);
  return response;
}
