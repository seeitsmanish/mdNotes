/**
 * The address a sign-in attempt is counted against (PRD §4.33).
 *
 * On Vercel the platform sets these headers itself, overwriting whatever the
 * client sent, so the first x-forwarded-for entry is the real client. Off
 * Vercel (local, self-hosted behind no proxy) they may be absent; everything
 * then counts as one address, which errs towards limiting, not towards
 * letting guesses through.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || headers.get("x-real-ip")?.trim() || "";
  // Bounded and plain: this is stored, so it must not be an arbitrary blob.
  return /^[0-9a-fA-F:.]{2,45}$/.test(candidate) ? candidate : "unknown";
}
