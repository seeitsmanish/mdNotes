/**
 * Turning note titles into filenames (PRD R8.4).
 *
 * Pure and separately tested, because the failure it prevents is silent: two
 * notes that collapse to the same filename lose one of them inside the zip, and
 * nobody notices until they need the missing note back.
 */

/** Illegal on Windows, plus path separators and control characters. */
const ILLEGAL = /[<>:"/\\|?*\u0000-\u001f]/g;
/** Windows refuses these names regardless of extension. */
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

const MAX_STEM = 80;

export function safeStem(title: string, fallback = "Untitled"): string {
  let stem = title
    .replace(ILLEGAL, " ")
    .replace(/\s+/g, " ")
    .trim()
    // Windows silently strips trailing dots and spaces from names, and a
    // leading dot makes the file hidden on Unix. Removing path separators
    // already prevents traversal; this stops "../x" leaving ".. x" behind.
    .replace(/^[. ]+/, "")
    .replace(/[. ]+$/, "");

  if (stem.length > MAX_STEM) {
    stem = stem.slice(0, MAX_STEM).trimEnd().replace(/[. ]+$/, "");
  }
  if (stem.length === 0 || RESERVED.test(stem)) stem = fallback;
  return stem;
}

/**
 * Hands out a unique name per call, suffixing duplicates as "Name 2", "Name 3".
 * Comparison is case-insensitive because macOS and Windows filesystems are.
 */
export function createNamer(extension = ".md") {
  const used = new Set<string>();

  return function name(title: string): string {
    const stem = safeStem(title);
    let candidate = stem;
    let counter = 2;

    while (used.has(candidate.toLowerCase())) {
      candidate = `${stem} ${counter}`;
      counter += 1;
    }

    used.add(candidate.toLowerCase());
    return candidate + extension;
  };
}
