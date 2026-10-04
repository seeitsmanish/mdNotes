import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };

/**
 * The commit the build came from, so a bug report can name an exact build
 * (PRD R7.1). Vercel sets this for git-connected deploys; a CLI deploy has no
 * .git to read, so "dev" is the honest answer rather than a fabricated hash.
 */
function commitSha(): string {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromVercel) return fromVercel.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

/**
 * Security headers (docs/SECURITY-AUDIT.md A3). The Content-Security-Policy
 * is not here: it carries a per-request nonce, so proxy.ts builds it for each
 * request (lib/security/csp.ts, PRD §4.34).
 */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // HTTPS only, for two years, on every subdomain (PRD §4.46). Vercel may add
  // its own; the app does not rely on that. Ignored by browsers over plain
  // http, so local development is unaffected.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // No other site's window keeps a handle on ours, and no other site may
  // embed our responses (images, JSON) as resources.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const config: NextConfig = {
  typedRoutes: true,
  // Do not advertise the framework and version to every visitor.
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/(.*)", headers: SECURITY_HEADERS },
      {
        // Shared notes (PRD §4.68): not indexed, never cached, and the link
        // never leaks onward in a Referer.
        source: "/s/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      {
        // Never cached, so a fixed service worker reaches every installed
        // copy on its next launch (PRD §4.27).
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_COMMIT_SHA: commitSha(),
  },
};

export default config;
