/**
 * Cross-site write protection (docs/SECURITY-AUDIT.md A9, PRD §4.46).
 *
 * The session cookie is SameSite=Lax, which already keeps it off cross-site
 * POSTs. This is the second fence: a state-changing request that the browser
 * itself labels cross-site — by Sec-Fetch-Site, or by an Origin whose host is
 * not ours — is refused before any handler runs. Requests with neither header
 * (curl, the backup script) pass; they carry no ambient browser credentials.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isCrossSiteWrite(method: string, headers: Headers): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false;

  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite === "cross-site" || fetchSite === "same-site") return true;

  const origin = headers.get("origin");
  if (!origin) return false;
  // Some browsers send "null" for privacy-sensitive contexts; never ours.
  if (origin === "null") return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return true;
  }
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  return !host || originHost.toLowerCase() !== host.toLowerCase();
}

export function crossSiteRefusal(): Response {
  return Response.json({ error: "Cross-site request refused." }, { status: 403 });
}
