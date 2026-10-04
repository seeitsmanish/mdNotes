/** Relative timestamps for note list rows (PRD R1.4). No dependency needed. */

import { type DateOptions, yearOf } from "./clock";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(
  iso: string,
  now: number = Date.now(),
  { timeZone, locale }: DateOptions = {},
): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const elapsed = now - then;
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d ago`;

  const sameYear = yearOf(then, timeZone) === yearOf(now, timeZone);
  return new Date(then).toLocaleDateString(locale, {
    timeZone,
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
