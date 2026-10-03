import "server-only";

import { cookies } from "next/headers";
import { getSessionEpoch } from "@/lib/db/settings";
import { readToken, SESSION_COOKIE, sessionKey } from "./token";

/**
 * The request-scoped gate.
 *
 * `proxy.ts` blocks unauthenticated traffic at the edge, but Next's own
 * guidance is not to rely on that alone — a route reachable another way would
 * sail straight past it. So every route handler and the page call
 * `requireSession()` too, and that is the check that actually protects notes.
 */

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in.");
    this.name = "UnauthorizedError";
  }
}

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    // Failing closed: a weak or missing secret must not silently downgrade to
    // "everyone is signed in".
    throw new Error(
      "AUTH_SECRET is missing or shorter than 32 characters. Generate one with: openssl rand -base64 32",
    );
  }
  return value;
}

function password(): string {
  const value = process.env.APP_PASSWORD;
  // Fail closed, like the secret: no password must not mean no lock.
  if (!value) throw new Error("APP_PASSWORD is missing.");
  return value;
}

/** The key sessions are signed with: secret + password (PRD R30.3). */
export function signingKey(): string {
  return sessionKey(secret(), password());
}

/**
 * A genuine, unexpired token issued under the current epoch (PRD §4.30). The
 * epoch check is what makes "sign out everywhere" real; the edge gate cannot
 * do it, having no database, so this is the check that counts.
 */
export async function hasSession(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const claims = await readToken(token, signingKey());
  if (!claims) return false;
  return claims.epoch === (await getSessionEpoch());
}

export async function requireSession(): Promise<void> {
  if (!(await hasSession())) throw new UnauthorizedError();
}

/** Wraps a route handler so an unauthenticated call is a 401, not a crash. */
export function guarded<T extends unknown[]>(
  handler: (...args: T) => Promise<Response>,
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      await requireSession();
    } catch {
      return Response.json({ error: "Not signed in." }, { status: 401 });
    }
    return handler(...args);
  };
}
