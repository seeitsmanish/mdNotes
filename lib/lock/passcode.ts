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

/**
 * What an unlock opens: one note (its id), or "all" — only for exporting
 * everything. Unlocking one note never opens another (PRD R69.7).
 */
export type UnlockScope = string;
const SCOPE = /^(all|[a-z0-9]{8,40})$/;

export function validScope(scope: unknown): scope is UnlockScope {
  return typeof scope === "string" && SCOPE.test(scope);
}

export function unlockToken(stored: string, secret: string, scope: UnlockScope, now = Date.now()): string {
  const payload = `${now + UNLOCK_MINUTES * 60_000}.${scope}.${fingerprint(stored)}`;
  return `${payload}.${sign(payload, secret)}`;
}

/** The scope a valid, unexpired token opens, or null. */
export function unlockedScope(token: string | undefined, stored: string | null, secret: string, now = Date.now()): UnlockScope | null {
  if (!token || !stored) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [expiry, scope, print, signature] = parts as [string, string, string, string];
  const expected = sign(`${expiry}.${scope}.${print}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!(Number(expiry) > now) || print !== fingerprint(stored) || !validScope(scope)) return null;
  return scope;
}

/** Whether the token opens `noteId` (or, with no id, everything). */
export function validUnlock(
  token: string | undefined,
  stored: string | null,
  secret: string,
  noteId?: string,
  now = Date.now(),
): boolean {
  const scope = unlockedScope(token, stored, secret, now);
  if (scope === null) return false;
  return scope === "all" || (noteId !== undefined && scope === noteId);
}
