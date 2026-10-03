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

export async function signToken(secret: string, ttlSeconds = SESSION_TTL_SECONDS): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = String(expiresAt);
  return `${payload}.${await hmac(payload, secret)}`;
}

export async function verifyToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt)) return false;

  // Verify the signature before trusting the expiry it carries.
  if (!safeEqual(signature, await hmac(payload, secret))) return false;

  return expiresAt > Math.floor(Date.now() / 1000);
}
