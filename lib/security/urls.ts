/**
 * URL checks at the two places user-controlled text becomes navigation
 * (docs/SECURITY-AUDIT.md). Pure, so each rule is tested rather than trusted.
 */

/**
 * The post-login redirect target, reduced to a same-origin path.
 *
 * A prefix check is not enough: browsers read `/\host` as `//host`, so
 * `?next=/\evil.example` passed `startsWith("/") && !startsWith("//")` and
 * sent a freshly signed-in user to another site (finding A1). Resolving
 * against our own origin and comparing origins is the check that cannot be
 * fooled by spelling.
 */
export function safeNextPath(next: string | null | undefined, origin: string): string {
  if (!next || !next.startsWith("/")) return "/";
  let resolved: URL;
  try {
    resolved = new URL(next, origin);
  } catch {
    return "/";
  }
  if (resolved.origin !== new URL(origin).origin) return "/";
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

const OPENABLE = new Set(["http:", "https:", "mailto:"]);

/**
 * A link from a note, if it is safe to open; otherwise null (finding A2).
 *
 * Notes arrive from imports, so their links are untrusted. `javascript:` must
 * never reach `window.open`; `data:`, `file:` and `vbscript:` have no business
 * there either. A bare `www.` autolink is upgraded to https so it still works.
 */
export function safeExternalUrl(href: string): string | null {
  const trimmed = href.trim();
  if (trimmed.length === 0) return null;
  const candidate = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null; // relative or malformed — nothing sensible to open
  }
  return OPENABLE.has(parsed.protocol) ? parsed.href : null;
}
