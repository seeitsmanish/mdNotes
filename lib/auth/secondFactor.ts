import { consumeRecovery, consumeStep, getTotpState } from "@/lib/db/settings";
import { hashRecovery, verifyCode } from "./totp";

/**
 * Checks a code from the authenticator app, or a recovery code (PRD §4.76).
 * Either is used up on success: a TOTP code's time step is recorded so it
 * cannot be replayed, a recovery code is deleted.
 */
export async function checkSecondFactor(secret: string, lastStep: number, code: string): Promise<"totp" | "recovery" | null> {
  const step = verifyCode(secret, code, lastStep);
  if (step !== null) return (await consumeStep(step)) ? "totp" : null;
  if (/^[a-z2-7]{5}-?[a-z2-7]{5}$/i.test(code.trim())) {
    const normalised = code.trim().toLowerCase().replace(/^(.{5})-?(.{5})$/, "$1-$2");
    if (await consumeRecovery(hashRecovery(normalised))) return "recovery";
  }
  return null;
}

export async function secondFactorEnabled(): Promise<boolean> {
  return (await getTotpState()).secret !== null;
}
