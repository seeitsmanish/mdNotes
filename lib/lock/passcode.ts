import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHmac } from "node:crypto";
import { promisify } from "node:util";

/**
 * The note-lock passcode and the unlock cookie (PRD §4.69). Server only.
 *
 * The passcode is stored as an scrypt hash. Unlocking sets a short-lived,
 * HMAC-signed cookie; the signature covers the expiry and a fingerprint of
 * the current hash, so changing the passcode ends every unlock at once.
 */

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number }) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1 };

export const UNLOCK_COOKIE = "ursa_unlock";
export const UNLOCK_MINUTES = 15;
export const MIN_PASSCODE = 4;

export async function hashPasscode(passcode: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(passcode, salt, 32, PARAMS);
  return `scrypt$${PARAMS.N}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPasscode(passcode: string, stored: string): Promise<boolean> {
  const [kind, n, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !n || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(passcode, Buffer.from(salt, "base64url"), expected.length, { ...PARAMS, N: Number(n) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** A hash fingerprint ties the cookie to this passcode. */
function fingerprint(stored: string): string {
  return createHmac("sha256", "ursa-lock").update(stored).digest("base64url").slice(0, 16);
}

export function unlockToken(stored: string, secret: string, now = Date.now()): string {
  const payload = `${now + UNLOCK_MINUTES * 60_000}.${fingerprint(stored)}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function validUnlock(token: string | undefined, stored: string | null, secret: string, now = Date.now()): boolean {
  if (!token || !stored) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expiry, print, signature] = parts as [string, string, string];
  const expected = sign(`${expiry}.${print}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return Number(expiry) > now && print === fingerprint(stored);
}
