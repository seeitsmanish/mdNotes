/**
 * How many rows search reads before ranking (PRD R11.6).
 *
 * Title matches and body matches are fetched separately, each capped. A single
 * capped query over both let 500 notes that merely mention a word crowd out
 * the note *titled* with it — the strongest match there is (R11.1).
 */
export const CANDIDATE_CAP = 500;

/**
 * Title matches first, then body matches, each note once. Ranking reorders
 * them afterwards; this only decides which rows are considered at all.
 */
export function mergeCandidates<T extends { id: string }>(byTitle: T[], byBody: T[]): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const row of [...byTitle, ...byBody]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged;
}
