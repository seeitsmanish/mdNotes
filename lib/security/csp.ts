/**
 * The Content Security Policy, built per request (PRD §4.34).
 *
 * Scripts: only those carrying this request's nonce run. Next stamps the
 * nonce on its own scripts (it reads it back out of this header), the theme
 * bootstrap carries it explicitly, and 'strict-dynamic' lets those trusted
 * scripts load the app's chunks. An inline script injected any other way —
 * the case 'unsafe-inline' used to allow (audit A3) — does not run.
 *
 * Styles keep 'unsafe-inline': CodeMirror injects <style> elements and the
 * editor sets style attributes, neither of which a nonce can cover, and an
 * injected style cannot run code. connect-src 'self' still keeps any script
 * that did run from sending a note anywhere else.
 */

export function buildCsp(nonce: string, options: { dev: boolean }): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${options.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${options.dev ? " ws: wss:" : ""}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** 128 random bits, base64 — unguessable, and fresh for every request. */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
