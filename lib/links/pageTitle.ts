import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";

/**
 * Fetches a web page's title for a pasted link (PRD §4.63).
 *
 * The server makes the request on the user's behalf, which is exactly what an
 * attacker would want to aim at internal services (SSRF). So: http(s) on the
 * default ports only, every hostname resolved and refused if any address is
 * private, loopback, link-local or otherwise not on the public internet —
 * checked at connect time, so DNS rebinding cannot slip one past —
 * redirects followed by hand and re-checked, a short timeout, and at most
 * 256KB read. Only the title comes back, never the page.
 */

const MAX_BYTES = 256 * 1024;
const TIMEOUT_MS = 4000;
const MAX_REDIRECTS = 3;

/** Whether an IPv4 or IPv6 address is somewhere a server-side fetch must not go. */
export function isBlockedAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a = 0, b = 0] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local, cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast and reserved
    );
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped?.[1]) return isBlockedAddress(mapped[1]);
    return (
      lower === "::" ||
      lower === "::1" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") || // unique local
      /^fe[89ab]/.test(lower) || // link-local
      lower.startsWith("ff") || // multicast
      lower.startsWith("64:ff9b:") // NAT64 can reach IPv4 internals
    );
  }
  return true;
}

/** The URL if it is one this server may fetch, else null. Pure syntax; DNS is checked separately. */
export function fetchableUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    return null;
  }
  if (isIP(host) && isBlockedAddress(host)) return null;
  return url;
}

/**
 * DNS lookup for the request itself, refusing any non-public address at the
 * moment of connecting. Checking a name first and fetching it after would
 * resolve it twice, and a hostile DNS server can answer the second time with
 * an internal address (DNS rebinding); here the address checked is the one
 * connected to.
 */
const safeLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { all: true, verbatim: true })
    .then((addresses) => {
      const allowed = addresses.filter((entry) => !isBlockedAddress(entry.address));
      if (allowed.length === 0 || allowed.length !== addresses.length) {
        callback(Object.assign(new Error("Address not allowed"), { code: "EBLOCKED" }), "", 4);
        return;
      }
      if ((options as { all?: boolean }).all) callback(null, allowed as never);
      else callback(null, allowed[0]!.address, allowed[0]!.family);
    })
    .catch((error: NodeJS.ErrnoException) => callback(error, "", 4));
};

interface Fetched {
  status: number;
  location: string | null;
  contentType: string;
  body: string;
}

/** One GET with the safe lookup, a deadline and a size cap. Never follows redirects itself. */
function get(url: URL, deadline: number): Promise<Fetched> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const host = url.hostname.replace(/^\[|\]$/g, "");
    // A literal IP never reaches the lookup; check it here instead.
    if (isIP(host) && isBlockedAddress(host)) {
      reject(new Error("Address not allowed"));
      return;
    }
    const request = client.get(
      url,
      {
        lookup: safeLookup,
        timeout: Math.max(500, deadline - Date.now()),
        headers: { accept: "text/html,application/xhtml+xml", "user-agent": "mdNotes link preview (+https://www.mdnotes.in)" },
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const contentType = String(response.headers["content-type"] ?? "");
        const location = typeof response.headers.location === "string" ? response.headers.location : null;
        if (status >= 300 || !/html/i.test(contentType)) {
          response.resume();
          resolve({ status, location, contentType, body: "" });
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.byteLength;
          if (size > MAX_BYTES) {
            response.destroy();
            return;
          }
          chunks.push(chunk);
        });
        const done = () => resolve({ status, location, contentType, body: Buffer.concat(chunks).toString("utf8") });
        response.on("end", done);
        response.on("close", done);
        response.on("error", reject);
      },
    );
    request.on("timeout", () => request.destroy(new Error("Timed out")));
    request.on("error", reject);
  });
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1]?.toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** The page's title from its HTML: og:title first, then <title>. Tidied and capped. */
export function extractTitle(html: string): string | null {
  const og =
    /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i.exec(html)?.[1] ??
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i.exec(html)?.[1];
  const raw = og ?? /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  if (!raw) return null;
  const title = decodeEntities(raw)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  return title || null;
}

export async function fetchPageTitle(raw: string): Promise<string | null> {
  let url = fetchableUrl(raw);
  const deadline = Date.now() + TIMEOUT_MS;
  try {
    for (let hop = 0; url && hop <= MAX_REDIRECTS; hop += 1) {
      const response = await get(url, deadline);
      if (response.status >= 300 && response.status < 400) {
        url = response.location ? fetchableUrl(new URL(response.location, url).toString()) : null;
        continue;
      }
      if (response.status < 200 || response.status >= 300 || !response.body) return null;
      return extractTitle(response.body);
    }
    return null;
  } catch {
    return null;
  }
}
