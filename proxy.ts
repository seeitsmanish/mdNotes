import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, sessionKey, verifyToken } from "@/lib/auth/token";
import { buildCsp, createNonce } from "@/lib/security/csp";

/**
 * Edge gate. In Next 16 this file is `proxy.ts` — `middleware.ts` is deprecated.
 *
 * This is the outer fence, not the lock: Next's guidance is that proxy code can
 * be bypassed if a route is ever reachable another way, so every route handler
 * and the page re-check the session via `requireSession()`. This exists so an
 * unauthenticated visitor gets a login page instead of a flash of the app.
 */

export const config = {
  // Everything except Next's own assets and the files in public/. Without this,
  // the gate would also block CSS and JS and the login page would render bare.
  // The manifest and service worker must load without a session cookie, or
  // the app cannot be installed (PRD §4.27).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

// /api/health answers uptime checks, which carry no session (PRD §4.32).
const PUBLIC_PATHS = new Set(["/login", "/api/auth/login", "/api/health"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // A fresh nonce and policy for every request (PRD §4.34). Next reads the
  // nonce back out of the request's CSP header and stamps its own scripts;
  // the layout reads x-nonce for the theme bootstrap.
  const nonce = createNonce();
  const csp = buildCsp(nonce, { dev: process.env.NODE_ENV !== "production" });
  const pass = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    const response = NextResponse.next({ request: { headers } });
    response.headers.set("Content-Security-Policy", csp);
    return response;
  };

  // A shared note's page and its images are public by design (PRD §4.68);
  // each handler checks the token itself.
  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/s/")) return pass();

  const secret = process.env.AUTH_SECRET;
  const password = process.env.APP_PASSWORD;
  // Fail closed. A missing or short secret must lock the app, never open it —
  // the same 32-character floor requireSession() enforces (SECURITY-AUDIT A6).
  const authed =
    secret && secret.length >= 32 && password
      ? await verifyToken(request.cookies.get(SESSION_COOKIE)?.value, sessionKey(secret, password))
      : false;
  if (authed) return pass();

  // An API call wants a status code, not a redirect to an HTML page.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  // The query matters: a share opened while signed out carries its content
  // there (PRD §4.31), and a shortcut its intent.
  const next = `${pathname}${request.nextUrl.search}`;
  if (next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}
