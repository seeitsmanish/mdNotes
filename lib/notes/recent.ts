/**
 * Recently opened notes, newest first (PRD §4.57), kept on the device so ⌘K
 * then Enter goes back to the note you were just in.
 */

export const RECENT_MAX = 10;
const KEY = "ursa-recent";

export function pushRecent(list: readonly string[], id: string, max = RECENT_MAX): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, max);
}

/** Recent notes that still exist, in recency order, without the open one. */
export function recentNotes<T extends { id: string }>(
  recent: readonly string[],
  notes: readonly T[],
  openId: string | null,
  limit = 6,
): T[] {
  const byId = new Map(notes.map((n) => [n.id, n]));
  return recent
    .filter((id) => id !== openId)
    .map((id) => byId.get(id))
    .filter((n): n is T => n !== undefined)
    .slice(0, limit);
}

export function loadRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function saveRecent(list: readonly string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // A convenience; blocked storage just means no recents.
  }
}
