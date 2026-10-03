/**
 * Session tokens: an expiry stamped with an HMAC, so the cookie carries its own
 * proof and there is no session table to keep.
 *
 * Web Crypto only — no Node APIs — because `proxy.ts` runs on the edge runtime.
 */

export const SESSION_COOKIE = "ursa_session";

/** How long a sign-in lasts before the password is asked for again. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

/**
 * Length-independent, branch-free comparison. A plain `===` on a signature
 * leaks how many leading bytes matched, which is enough to forge one.
 */
export function safeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  // Compare lengths without returning early.
  let diff = left.length ^ right.length;
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

/**
 * The HMAC key for sessions: the secret and the password together, so that
 * changing APP_PASSWORD ends every session at once (PRD R30.3) — before
 * v1.19 a password change left every old cookie working.
 */
export function sessionKey(secret: string, password: string): string {
  return `${secret}\u0000${password}`;
}

/**
 * `<expiresAt>.<epoch>.<signature>`. The epoch is the one in force when the
 * session began; raising the stored epoch ends it (PRD §4.30).
 */
export async function signToken(key: string, epoch: number, ttlSeconds = SESSION_TTL_SECONDS): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${expiresAt}.${epoch}`;
  return `${payload}.${await hmac(payload, key)}`;
}

export interface SessionClaims {
  expiresAt: number;
  epoch: number;
}

/** The claims of a genuine, unexpired token, or null. */
export async function readToken(token: string | undefined, key: string): Promise<SessionClaims | null> {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  const match = /^(\d{1,12})\.(\d{1,9})$/.exec(payload);
  if (!match) return null;

  // Verify the signature before trusting anything the payload says.
  if (!safeEqual(signature, await hmac(payload, key))) return null;

  const expiresAt = Number(match[1]);
  const epoch = Number(match[2]);
  if (expiresAt <= Math.floor(Date.now() / 1000)) return null;
  return { expiresAt, epoch };
}

/** Signature and expiry only — what the edge gate can check without a database. */
export async function verifyToken(token: string | undefined, key: string): Promise<boolean> {
  return (await readToken(token, key)) !== null;
}
