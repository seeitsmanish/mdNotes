import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Fetches a web page's title for a pasted link (PRD §4.63).
 *
 * The server makes the request on the user's behalf, which is exactly what an
 * attacker would want to aim at internal services (SSRF). So: http(s) on the
 * default ports only, every hostname resolved and refused if any address is
 * private, loopback, link-local or otherwise not on the public internet,
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

async function resolvesPublic(host: string): Promise<boolean> {
  const bare = host.replace(/^\[|\]$/g, "");
  if (isIP(bare)) return !isBlockedAddress(bare);
  try {
    const addresses = await lookup(bare, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every((entry) => !isBlockedAddress(entry.address));
  } catch {
    return false;
  }
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

async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const buffer = new Uint8Array(Math.min(total, MAX_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    const room = buffer.length - offset;
    if (room <= 0) break;
    buffer.set(chunk.subarray(0, room), offset);
    offset += Math.min(chunk.byteLength, room);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}

export async function fetchPageTitle(raw: string): Promise<string | null> {
  let url = fetchableUrl(raw);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    for (let hop = 0; url && hop <= MAX_REDIRECTS; hop += 1) {
      if (!(await resolvesPublic(url.hostname))) return null;
      const response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { accept: "text/html,application/xhtml+xml", "user-agent": "mdNotes link preview (+https://www.mdnotes.in)" },
      });
      if (response.status >= 300 && response.status < 400) {
        const next = response.headers.get("location");
        await response.body?.cancel().catch(() => undefined);
        url = next ? fetchableUrl(new URL(next, url).toString()) : null;
        continue;
      }
      if (!response.ok || !/html/i.test(response.headers.get("content-type") ?? "")) {
        await response.body?.cancel().catch(() => undefined);
        return null;
      }
      return extractTitle(await readCapped(response));
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
