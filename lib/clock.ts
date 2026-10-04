/**
 * The clock the note list renders against (PRD R38.6).
 *
 * The list is rendered on the server, in UTC, and hydrated in the browser, in
 * the owner's timezone and locale. "Today", "Yesterday", "17m ago" and
 * "3 Oct" all depend on those, so the two renders disagreed — and React
 * answers a hydration mismatch by discarding the server's HTML and rendering
 * the whole page again. So the browser stores its timezone and locale in a
 * cookie, the server renders with them and with its own render time, and the
 * browser hydrates with exactly that before switching to its live clock.
 */

export interface Clock {
  now: number;
  timeZone?: string;
  locale?: string;
}

export const CLOCK_COOKIE = "ursa-clock";

export interface DateOptions {
  timeZone?: string;
  locale?: string;
}

function validTimeZone(value: string): string | undefined {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return value;
  } catch {
    return undefined;
  }
}

function validLocale(value: string): string | undefined {
  try {
    return Intl.getCanonicalLocales(value)[0];
  } catch {
    return undefined;
  }
}

export function encodeClockCookie(timeZone: string, locale: string): string {
  return encodeURIComponent(`${timeZone}|${locale}`);
}

/** Reads the cookie, keeping only values Intl accepts; anything else is dropped. */
export function parseClockCookie(raw: string | undefined): DateOptions {
  if (!raw || raw.length > 200) return {};
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return {};
  }
  const [zone = "", locale = ""] = decoded.split("|");
  return { timeZone: validTimeZone(zone), locale: validLocale(locale) };
}

/** The calendar date of an instant in a timezone, as a UTC day number. */
export function dayNumber(ms: number, timeZone?: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ms);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Math.round(Date.UTC(get("year"), get("month") - 1, get("day")) / 86_400_000);
}

export function yearOf(ms: number, timeZone?: string): number {
  return Number(new Intl.DateTimeFormat("en", { timeZone, year: "numeric" }).format(ms));
}
