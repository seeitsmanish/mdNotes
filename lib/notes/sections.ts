/**
 * Date sections for the note list (PRD R38.1): Pinned, Today, Yesterday,
 * Previous 7 days, Previous 30 days, then one per month this year and one per
 * earlier year — the way Apple Notes and Bear group a long list, so a glance
 * says how recent a note is without reading every timestamp.
 *
 * Expects the list's own order: pinned first, then newest first. A note is
 * labelled by local calendar day, not by elapsed hours, so "Yesterday" means
 * yesterday at 23:59 as well as at 00:01.
 */

import { type DateOptions, dayNumber, yearOf } from "@/lib/clock";

export interface Sectioned<T> {
  label: string;
  items: T[];
}

export function sectionLabel(iso: string, now: number = Date.now(), options: DateOptions = {}): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Earlier";
  const { timeZone, locale } = options;
  const days = dayNumber(now, timeZone) - dayNumber(then, timeZone);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Previous 7 days";
  if (days < 30) return "Previous 30 days";
  if (yearOf(then, timeZone) === yearOf(now, timeZone)) {
    return new Date(then).toLocaleDateString(locale, { month: "long", timeZone });
  }
  return String(yearOf(then, timeZone));
}

export function sectionNotes<T extends { pinned: boolean; updatedAt: string }>(
  notes: readonly T[],
  now: number = Date.now(),
  options: DateOptions = {},
): Sectioned<T>[] {
  const sections: Sectioned<T>[] = [];
  for (const note of notes) {
    const label = note.pinned ? "Pinned" : sectionLabel(note.updatedAt, now, options);
    const last = sections[sections.length - 1];
    if (last && last.label === label) last.items.push(note);
    else sections.push({ label, items: [note] });
  }
  return sections;
}
