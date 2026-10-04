import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { guarded } from "@/lib/auth/session";
import { clientIp } from "@/lib/auth/clientIp";
import { issueSession } from "@/lib/auth/issue";
import { checkSecondFactor } from "@/lib/auth/secondFactor";
import { hashRecovery, newRecoveryCodes, newSecret, otpauthUri, verifyCode } from "@/lib/auth/totp";
import { isLimited, recordFailure, clearFailures } from "@/lib/db/loginFailures";
import { bumpSessionEpoch, disableTotp, enableTotp, getTotpState, setTotpPending } from "@/lib/db/settings";

/**
 * Two-step sign-in settings (PRD §4.76).
 *
 * GET: whether it is on, and how many recovery codes are left.
 * POST { action: "begin" }: a new secret, as a QR code and as text.
 * POST { action: "confirm", code }: the first code from the app turns it on;
 *   returns ten recovery codes, shown once, and signs out every other device.
 * POST { action: "disable", code }: a current code (or a recovery code) turns it off.
 */

async function handleGET() {
  const state = await getTotpState();
  return NextResponse.json({ enabled: state.secret !== null, recoveryLeft: state.recovery.length });
}

async function handlePOST(request: Request) {
  let payload: { action?: unknown; code?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const ip = `2fa:${clientIp(request.headers)}`;
  if (await isLimited(ip)) {
    return NextResponse.json({ error: "Too many wrong codes. Wait a few minutes and try again." }, { status: 429 });
  }
  const state = await getTotpState();
  const code = typeof payload.code === "string" ? payload.code : "";

  if (payload.action === "begin") {
    if (state.secret) return NextResponse.json({ error: "Two-step sign-in is already on." }, { status: 409 });
    const secret = newSecret();
    await setTotpPending(secret);
    const uri = otpauthUri(secret);
    const qr = await QRCode.toString(uri, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    return NextResponse.json({ secret, uri, qr: `data:image/svg+xml;base64,${Buffer.from(qr).toString("base64")}` });
  }

  if (payload.action === "confirm") {
    if (state.secret) return NextResponse.json({ error: "Two-step sign-in is already on." }, { status: 409 });
    if (!state.pending) return NextResponse.json({ error: "Start again: no setup in progress." }, { status: 409 });
    const step = verifyCode(state.pending, code, 0);
    if (step === null) {
      await recordFailure(ip);
      return NextResponse.json({ error: "That code isn’t right. Check the app shows mdNotes, and try the current code." }, { status: 403 });
    }
    const recoveryCodes = newRecoveryCodes();
    await enableTotp(state.pending, step, recoveryCodes.map(hashRecovery));
    await clearFailures(ip);
    // Anyone who had the password alone is signed out; this browser stays in.
    await bumpSessionEpoch();
    const response = NextResponse.json({ enabled: true, recoveryCodes });
    await issueSession(response);
    return response;
  }

  if (payload.action === "disable") {
    if (!state.secret) return NextResponse.json({ enabled: false });
    if (!(await checkSecondFactor(state.secret, state.lastStep, code))) {
      await recordFailure(ip);
      return NextResponse.json({ error: "That code isn’t right." }, { status: 403 });
    }
    await disableTotp();
    await clearFailures(ip);
    return NextResponse.json({ enabled: false });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

export const GET = guarded(handleGET);
export const POST = guarded(handlePOST);
