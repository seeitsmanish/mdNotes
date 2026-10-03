/**
 * Deciding what in an upload is a note (PRD §4.9).
 *
 * Pure so the rules can be tested without a database or a request: this is the
 * code that decides whether a file becomes a note or is silently dropped, and
 * silent drops are the failure mode that matters.
 */

export const MARKDOWN_EXTENSIONS = [".md", ".markdown", ".mdown", ".txt"];

export const IMPORT_LIMITS = {
  maxFiles: 2000,
  maxTotalBytes: 50 * 1024 * 1024,
  maxFileBytes: 2 * 1024 * 1024,
} as const;

export type SkipReason = "not-markdown" | "empty" | "metadata" | "too-large";

export interface ImportCandidate {
  path: string;
  body: string;
}

export interface ImportDecision {
  accepted: ImportCandidate[];
  skipped: Array<{ path: string; reason: SkipReason }>;
}

function isMetadata(path: string): boolean {
  const name = path.split("/").pop() ?? path;
  return (
    path.startsWith("__MACOSX/") ||
    path.includes("/__MACOSX/") ||
    name.startsWith("._") ||
    name === ".DS_Store" ||
    name === "Thumbs.db"
  );
}

export function isMarkdownPath(path: string): boolean {
  const lower = path.toLowerCase();
  return MARKDOWN_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/** Classify one file. Directories are expected to be filtered out by the caller. */
export function classify(path: string, body: string, byteLength: number): SkipReason | null {
  if (isMetadata(path)) return "metadata";
  if (!isMarkdownPath(path)) return "not-markdown";
  if (byteLength > IMPORT_LIMITS.maxFileBytes) return "too-large";
  if (body.trim().length === 0) return "empty";
  return null;
}

export function decide(
  files: Array<{ path: string; body: string; byteLength: number }>,
): ImportDecision {
  const accepted: ImportCandidate[] = [];
  const skipped: ImportDecision["skipped"] = [];

  for (const file of files) {
    const reason = classify(file.path, file.body, file.byteLength);
    if (reason) skipped.push({ path: file.path, reason });
    else accepted.push({ path: file.path, body: file.body });
  }

  return { accepted, skipped };
}

export function describeSkip(reason: SkipReason): string {
  switch (reason) {
    case "not-markdown":
      return "not a markdown file";
    case "empty":
      return "empty";
    case "metadata":
      return "system file";
    case "too-large":
      return "larger than 2 MB";
  }
}
