/**
 * Which lines of an earlier version are gone from the note now (PRD §4.28),
 * so a list of versions can say what each would bring back without making
 * anyone read two full texts side by side.
 *
 * A line LCS. Quadratic, so it is capped: beyond the cap the comparison is
 * skipped rather than freezing the dialog on a huge note.
 */

const MAX_CELLS = 4_000_000;

export interface LineDiff {
  /** One entry per line of the earlier version: true if it is gone now. */
  goneNow: boolean[];
  /** Lines in the earlier version that are not in the note now. */
  removed: number;
  /** Lines in the note now that the earlier version did not have. */
  added: number;
  /** False when the texts were too large to compare. */
  compared: boolean;
}

export function diffLines(earlier: string, now: string): LineDiff {
  const a = earlier.split("\n");
  const b = now.split("\n");
  if (a.length * b.length > MAX_CELLS) {
    return { goneNow: a.map(() => false), removed: 0, added: 0, compared: false };
  }

  // lengths[i][j] = LCS of a[i..] and b[j..], filled from the end.
  const width = b.length + 1;
  const lengths = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lengths[i * width + j] =
        a[i] === b[j]
          ? (lengths[(i + 1) * width + j + 1] ?? 0) + 1
          : Math.max(lengths[(i + 1) * width + j] ?? 0, lengths[i * width + j + 1] ?? 0);
    }
  }

  const goneNow = a.map(() => true);
  let i = 0;
  let j = 0;
  let common = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      goneNow[i] = false;
      common += 1;
      i += 1;
      j += 1;
    } else if ((lengths[(i + 1) * width + j] ?? 0) >= (lengths[i * width + j + 1] ?? 0)) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return { goneNow, removed: a.length - common, added: b.length - common, compared: true };
}
